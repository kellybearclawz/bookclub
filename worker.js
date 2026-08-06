/**
 * Book Club "Add a Book" backend
 * -------------------------------
 * Runs on Cloudflare Workers (free tier). Holds your GitHub token as a
 * secret so it never touches the browser. Receives a book from the form,
 * appends it as a row to the CSV in your GitHub repo, and commits it.
 *
 * SETUP (see SETUP.md for the full walkthrough):
 *   1. Create a fine-grained GitHub token scoped ONLY to the bookclub repo,
 *      with "Contents: Read and write" permission.
 *   2. Deploy this file as a Cloudflare Worker.
 *   3. In the Worker's Settings > Variables, add these as SECRETS:
 *        GITHUB_TOKEN   - the token from step 1
 *        SHARED_SECRET  - a password you make up, shared only with your form
 *   4. (Optional) add plain variables to override the defaults below:
 *        OWNER, REPO, FILE_PATH, BRANCH
 */

const DEFAULTS = {
  OWNER: 'kellybearclawz',
  REPO: 'bookclub',
  FILE_PATH: 'Book Club - Books Read_ISBN.csv',
  BRANCH: 'main', // change to 'master' in your Worker variables if that's your default branch
};

const CSV_COLUMNS = [
  'title', 'author', 'genre', 'subGenre', 'datePublished',
  'yearPublished', 'meetingDate', 'host', 'location', 'isbn', 'goodreadsUrl'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-shared-secret',
  };
}

function csvEscape(val) {
  val = val === undefined || val === null ? '' : String(val);
  if (/[",\n]/.test(val)) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
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

async function githubRequest(env, method, body) {
  const { OWNER, REPO, FILE_PATH } = {
    OWNER: env.OWNER || DEFAULTS.OWNER,
    REPO: env.REPO || DEFAULTS.REPO,
    FILE_PATH: env.FILE_PATH || DEFAULTS.FILE_PATH,
  };
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bookclub-add-book-worker',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Use POST' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const secret = request.headers.get('x-shared-secret');
    if (!env.SHARED_SECRET || secret !== env.SHARED_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Bad JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const book = payload.book || {};
    if (!book.title || !book.author) {
      return new Response(JSON.stringify({ ok: false, error: 'Title and author are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const branch = env.BRANCH || DEFAULTS.BRANCH;

    // Retry once on sha conflict (in case of concurrent edits)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // 1. Get current file + sha
        const getRes = await githubRequest(env, 'GET');
        if (!getRes.ok) {
          const errText = await getRes.text();
          return new Response(
            JSON.stringify({ ok: false, error: `GitHub read failed: ${getRes.status} ${errText}` }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
          );
        }
        const fileData = await getRes.json();
        let text = b64ToUtf8(fileData.content);
        if (!text.endsWith('\n')) text += '\n';

        // 2. Build and append the new row
        const row = CSV_COLUMNS.map((key) => csvEscape(book[key])).join(',') + '\n';
        const newText = text + row;

        // 3. Commit the updated file
        const putRes = await githubRequest(env, 'PUT', {
          message: `Add "${book.title}" by ${book.author}`,
          content: utf8ToB64(newText),
          sha: fileData.sha,
          branch,
        });

        if (putRes.status === 409 && attempt === 0) {
          continue; // sha changed underneath us — retry once
        }
        if (!putRes.ok) {
          const errText = await putRes.text();
          return new Response(
            JSON.stringify({ ok: false, error: `GitHub write failed: ${putRes.status} ${errText}` }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
          );
        }

        const putJson = await putRes.json();
        return new Response(
          JSON.stringify({ ok: true, commit: putJson.commit && putJson.commit.html_url }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'Conflict, please retry' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
