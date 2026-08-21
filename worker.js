/**
 * Book Club backend — Cloudflare Worker
 * ---------------------------------------
 * Handles two things, routed by path:
 *   POST /            -> add a new book row (existing behavior, unchanged)
 *   POST /schedule     -> claim or edit a 2027 meeting date's host/location
 *
 * SETUP — in addition to the secrets you already set (GITHUB_TOKEN,
 * SHARED_SECRET), add these two for the new schedule feature:
 *   SCHEDULE_FILE_PATH  - defaults to '2027-schedule.csv' if unset
 *   CLUB_SECRET         - a low-stakes passcode you share with club members.
 *                         This is NOT real security — it's baked into the
 *                         signup page's source so anyone with the page can
 *                         see it. It only exists to keep random bots off
 *                         the endpoint, not to gate club members from
 *                         signing up or editing.
 */

const DEFAULTS = {
  OWNER: 'kellybearclawz',
  REPO: 'bookclub',
  FILE_PATH: 'Book Club - Books Read_ISBN.csv',
  SCHEDULE_FILE_PATH: '2027-schedule.csv',
  BRANCH: 'main',
};

const BOOK_CSV_COLUMNS = [
  'title', 'author', 'genre', 'subGenre', 'datePublished',
  'yearPublished', 'meetingDate', 'host', 'location', 'isbn', 'goodreadsUrl'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-shared-secret, x-club-secret',
  };
}
function jsonResponse(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function csvEscape(val) {
  val = val === undefined || val === null ? '' : String(val);
  if (/[",\n]/.test(val)) return '"' + val.replace(/"/g, '""') + '"';
  return val;
}

// Quote-aware CSV parser (needed for the schedule file, since we rewrite
// specific rows rather than just appending like the book file does).
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}
function rowsToCSV(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function githubGet(env, path) {
  const OWNER = env.OWNER || DEFAULTS.OWNER;
  const REPO = env.REPO || DEFAULTS.REPO;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bookclub-worker',
    },
  });
}
async function githubPut(env, path, body) {
  const OWNER = env.OWNER || DEFAULTS.OWNER;
  const REPO = env.REPO || DEFAULTS.REPO;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bookclub-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ---------- POST / : add a book row (unchanged behavior) ----------
async function handleAddBook(request, env, origin) {
  let payload;
  try { payload = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'Bad JSON' }, 400, origin); }

  const book = payload.book || {};
  if (!book.title || !book.author) {
    return jsonResponse({ ok: false, error: 'Title and author are required' }, 400, origin);
  }

  const path = env.FILE_PATH || DEFAULTS.FILE_PATH;
  const branch = env.BRANCH || DEFAULTS.BRANCH;

  for (let attempt = 0; attempt < 2; attempt++) {
    const getRes = await githubGet(env, path);
    if (!getRes.ok) return jsonResponse({ ok: false, error: `GitHub read failed: ${getRes.status}` }, 502, origin);
    const fileData = await getRes.json();
    let text = b64ToUtf8(fileData.content);
    if (!text.endsWith('\n')) text += '\n';

    const row = BOOK_CSV_COLUMNS.map((key) => csvEscape(book[key])).join(',') + '\n';
    const newText = text + row;

    const putRes = await githubPut(env, path, {
      message: `Add "${book.title}" by ${book.author}`,
      content: utf8ToB64(newText),
      sha: fileData.sha,
      branch,
    });

    if (putRes.status === 409 && attempt === 0) continue;
    if (!putRes.ok) return jsonResponse({ ok: false, error: `GitHub write failed: ${putRes.status}` }, 502, origin);

    const putJson = await putRes.json();
    return jsonResponse({ ok: true, commit: putJson.commit && putJson.commit.html_url }, 200, origin);
  }
  return jsonResponse({ ok: false, error: 'Conflict, please retry' }, 409, origin);
}

// ---------- POST /schedule : claim or edit a meeting date ----------
async function handleSchedule(request, env, origin) {
  let payload;
  try { payload = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'Bad JSON' }, 400, origin); }

  const { meetingDate, host, location } = payload;
  if (!meetingDate) {
    return jsonResponse({ ok: false, error: 'Meeting date is required' }, 400, origin);
  }

  const path = env.SCHEDULE_FILE_PATH || DEFAULTS.SCHEDULE_FILE_PATH;
  const branch = env.BRANCH || DEFAULTS.BRANCH;

  for (let attempt = 0; attempt < 2; attempt++) {
    const getRes = await githubGet(env, path);
    if (!getRes.ok) return jsonResponse({ ok: false, error: `GitHub read failed: ${getRes.status}` }, 502, origin);
    const fileData = await getRes.json();
    const text = b64ToUtf8(fileData.content);
    const rows = parseCSV(text);

    const header = rows[0];
    const dateCol = header.indexOf('Meeting Date');
    const hostCol = header.indexOf('Host');
    const locCol = header.indexOf('Location');
    if (dateCol === -1 || hostCol === -1) {
      return jsonResponse({ ok: false, error: 'Schedule file is missing expected columns' }, 500, origin);
    }

    const rowIndex = rows.findIndex((r, i) => i > 0 && r[dateCol] === meetingDate);
    if (rowIndex === -1) {
      return jsonResponse({ ok: false, error: `No schedule row found for ${meetingDate}` }, 404, origin);
    }

    rows[rowIndex][hostCol] = host || '';
    if (locCol > -1) rows[rowIndex][locCol] = location || '';

    const newText = rowsToCSV(rows);
    const commitMessage = host
      ? `Schedule: ${host} signed up for ${meetingDate}`
      : `Schedule: cleared signup for ${meetingDate}`;
    const putRes = await githubPut(env, path, {
      message: commitMessage,
      content: utf8ToB64(newText),
      sha: fileData.sha,
      branch,
    });

    if (putRes.status === 409 && attempt === 0) continue;
    if (!putRes.ok) return jsonResponse({ ok: false, error: `GitHub write failed: ${putRes.status}` }, 502, origin);

    const putJson = await putRes.json();
    return jsonResponse({ ok: true, commit: putJson.commit && putJson.commit.html_url }, 200, origin);
  }
  return jsonResponse({ ok: false, error: 'Conflict, please retry' }, 409, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405, origin);

    if (pathname === '/schedule') {
      const clubSecret = request.headers.get('x-club-secret');
      if (!env.CLUB_SECRET || clubSecret !== env.CLUB_SECRET) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, origin);
      }
      return handleSchedule(request, env, origin);
    }

    // default: add-book, same as before
    const secret = request.headers.get('x-shared-secret');
    if (!env.SHARED_SECRET || secret !== env.SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, origin);
    }
    return handleAddBook(request, env, origin);
  },
};
