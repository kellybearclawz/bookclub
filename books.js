// ─── Cover fetching via Google Dynamic Links API ──────────────────────────────
// Splits ISBNs into batches of 20 to stay within URL length limits.
// Each batch uses a unique callback name to avoid collisions.

const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';

function fetchCoverBatch(isbns) {
  return new Promise((resolve) => {
    const result = {};
    if (!isbns.length) { resolve(result); return; }

    const cbName = '__gbcb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const bibkeys = isbns.map(i => 'ISBN:' + i).join(',');
    const timeout = setTimeout(() => { delete window[cbName]; resolve(result); }, 8000);

    window[cbName] = function(data) {
      clearTimeout(timeout);
      for (var key in data) {
        var isbn = key.replace('ISBN:', '');
        if (data[key].thumbnail_url) {
          result[isbn] = data[key].thumbnail_url.replace('http://', 'https://');
        }
      }
      delete window[cbName];
      resolve(result);
    };

    var script = document.createElement('script');
    script.src = 'https://books.google.com/books?bibkeys=' + encodeURIComponent(bibkeys) + '&jscmd=viewapi&callback=' + cbName;
    script.onerror = function() { clearTimeout(timeout); resolve(result); };
    document.head.appendChild(script);
  });
}

async function fetchAllCovers(isbns) {
  var unique = [];
  isbns.forEach(function(i) { if (i && unique.indexOf(i) === -1) unique.push(i); });
  var coverMap = {};
  var batchSize = 20;
  for (var i = 0; i < unique.length; i += batchSize) {
    var batch = unique.slice(i, i + batchSize);
    var result = await fetchCoverBatch(batch);
    Object.assign(coverMap, result);
  }
  return coverMap;
}

// ─── Description fetching (Google Books, keyed + cached; Open Library fallback) ─
// Same approach as index.html: ISBN search first, title+author search as a
// fallback (the isbn: operator is unreliable), Open Library as a last resort.
// Descriptions are cached per-ISBN in localStorage — and this cache key is
// shared with index.html, so a book looked up there is free here too.

// Same restricted key used on index.html — same site, same restriction covers it.
var GOOGLE_BOOKS_API_KEY = 'AIzaSyDSiQQtLx4-J-0Ox0Gt1jhajcx3trSlhrc';
var CACHE_DAYS = 30;
var DESC_MAX_LENGTH = 220;

function descCacheGet(isbn) {
  try {
    var raw = localStorage.getItem('bookinfo:' + isbn);
    if (!raw) return null;
    var cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_DAYS * 24 * 60 * 60 * 1000) return null;
    return cached.data;
  } catch (e) { return null; }
}
function descCacheSet(isbn, data) {
  try { localStorage.setItem('bookinfo:' + isbn, JSON.stringify({ ts: Date.now(), data: data })); }
  catch (e) { /* storage full or unavailable — fine to skip caching */ }
}

function googleBooksSearch(query) {
  var url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=1';
  if (GOOGLE_BOOKS_API_KEY) url += '&key=' + GOOGLE_BOOKS_API_KEY;
  return fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) { return (data.items && data.items.length) ? data.items[0].volumeInfo : null; })
    .catch(function() { return null; });
}
function extractDescription(vol) {
  return (vol && typeof vol.description === 'string' && vol.description.trim()) ? vol.description : null;
}
function openLibraryDescription(isbn) {
  return fetch('https://openlibrary.org/isbn/' + isbn + '.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(edition) {
      var workKey = edition && edition.works && edition.works[0] && edition.works[0].key;
      if (!workKey) return null;
      return fetch('https://openlibrary.org' + workKey + '.json').then(function(r) { return r.ok ? r.json() : null; });
    })
    .then(function(work) {
      if (!work || !work.description) return null;
      return typeof work.description === 'string' ? work.description : (work.description.value || null);
    })
    .catch(function() { return null; });
}

async function fetchDescription(isbn, title, author) {
  if (isbn) {
    var cached = descCacheGet(isbn);
    if (cached !== null) return cached;
  }

  var vol = isbn ? await googleBooksSearch('isbn:' + isbn) : null;
  var description = extractDescription(vol);

  if (!description && title) {
    var query = 'intitle:' + title + (author ? ' inauthor:' + author : '');
    var vol2 = await googleBooksSearch(query);
    description = extractDescription(vol2) || description;
  }

  if (!description && isbn) {
    description = await openLibraryDescription(isbn);
  }

  if (isbn && description) descCacheSet(isbn, description);
  return description;
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  var cut = text.slice(0, max);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return cut.trim() + '…';
}

// Populate descriptions after cards are rendered, in small staggered batches
// so ~80 books don't all hit the API in one burst.
async function populateDescriptions(queue) {
  var batchSize = 5;
  var delayMs = 350;
  for (var i = 0; i < queue.length; i += batchSize) {
    var batch = queue.slice(i, i + batchSize);
    await Promise.all(batch.map(async function(item) {
      var desc = await fetchDescription(item.isbn, item.title, item.author);
      if (desc) {
        item.descEl.textContent = truncate(desc, DESC_MAX_LENGTH);
        item.descEl.classList.remove('loading');
      } else {
        item.descEl.remove(); // no description available anywhere — skip the line entirely
      }
    }));
    if (i + batchSize < queue.length) await new Promise(function(r) { setTimeout(r, delayMs); });
  }
}

// ─── Search ─────────────────────────────────────────────────────────────────

function setupSearch() {
  var input = document.getElementById('book-search');
  if (!input) return;
  input.addEventListener('input', function() {
    var q = this.value.trim().toLowerCase();
    document.querySelectorAll('.book-card').forEach(function(card) {
      var match = !q || card.dataset.title.indexOf(q) > -1 || card.dataset.author.indexOf(q) > -1;
      card.style.display = match ? '' : 'none';
    });
    document.querySelectorAll('main section[id^="year-"]').forEach(function(section) {
      var anyVisible = Array.prototype.some.call(section.querySelectorAll('.book-card'), function(c) {
        return c.style.display !== 'none';
      });
      section.style.display = anyVisible ? '' : 'none';
    });
    document.querySelectorAll('.year-links a').forEach(function(a) {
      var year = a.getAttribute('href').replace('#year-', '');
      var section = document.getElementById('year-' + year);
      a.style.display = (section && section.style.display !== 'none') ? '' : 'none';
    });
  });
}

// ─── Main render ─────────────────────────────────────────────────────────────

async function renderBooks(data) {
  var shelf = document.getElementById('bookshelf');

  // Group books by year
  var booksByYear = {};
  data.forEach(function(book) {
    var year = new Date(book['Meeting Date']).getFullYear();
    if (!booksByYear[year]) booksByYear[year] = [];
    booksByYear[year].push(book);
  });

  var years = Object.keys(booksByYear).sort().reverse();

  // Year jump links
  var yearLinksDiv = document.createElement('div');
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(function(y) {
    return '<a href="#year-' + y + '">' + y + '</a>';
  }).join('');
  shelf.appendChild(yearLinksDiv);

  // Fetch all covers up front in batches
  var allISBNs = data.map(function(b) {
    return b.ISBN ? b.ISBN.replace(/[^0-9Xx]/g, '') : '';
  }).filter(Boolean);
  var coverMap = await fetchAllCovers(allISBNs);

  var descQueue = [];

  // Render year sections
  years.forEach(function(year) {
    var section = document.createElement('section');
    section.id = 'year-' + year;

    var heading = document.createElement('h2');
    heading.textContent = year;
    section.appendChild(heading);

    var bookContainer = document.createElement('div');
    bookContainer.className = 'book-container';

    var booksInYear = booksByYear[year].slice().reverse();
    booksInYear.forEach(function(book, index) {
      var isbn = book.ISBN ? book.ISBN.replace(/[^0-9Xx]/g, '') : '';
      var coverUrl = (isbn && coverMap[isbn]) ? coverMap[isbn] : FALLBACK;

      var bookDiv = document.createElement('div');
      bookDiv.className = 'book-card fade-in';
      bookDiv.style.animationDelay = (index * 0.06) + 's';
      bookDiv.dataset.title = (book.Title || '').toLowerCase();
      bookDiv.dataset.author = (book.Author || '').toLowerCase();

      var img = document.createElement('img');
      img.src = coverUrl;
      img.alt = 'Cover of ' + book.Title;
      img.onerror = function() { this.onerror = null; this.src = FALLBACK; };

      var info = document.createElement('div');
      var strong = document.createElement('strong');
      strong.textContent = book.Title;
      var details = document.createElement('p');
      details.innerHTML = 'by ' + book.Author + '<br>Meeting: ' + book['Meeting Date'];

      var descP = document.createElement('p');
      descP.className = 'book-desc loading';
      descP.textContent = 'Loading synopsis…';

      var linkP = document.createElement('p');
      var a = document.createElement('a');
      a.href = book['Goodreads URL'];
      a.target = '_blank';
      a.textContent = 'Goodreads ↗';
      linkP.appendChild(a);

      info.appendChild(strong);
      info.appendChild(details);
      info.appendChild(descP);
      info.appendChild(linkP);

      bookDiv.appendChild(img);
      bookDiv.appendChild(info);
      bookContainer.appendChild(bookDiv);

      if (isbn) {
        descQueue.push({ isbn: isbn, title: book.Title, author: book.Author, descEl: descP });
      } else {
        descP.remove();
      }
    });

    section.appendChild(bookContainer);

    var backToTop = document.createElement('div');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = '<a href="#top">↑ Back to top</a>';
    section.appendChild(backToTop);

    shelf.appendChild(section);
  });

  // Floating top button
  var topLink = document.createElement('a');
  topLink.href = '#top';
  topLink.id = 'top-link';
  topLink.textContent = '↑ Top';
  document.body.appendChild(topLink);

  window.addEventListener('scroll', function() {
    topLink.classList.toggle('show', window.scrollY > 400);
  });

  populateDescriptions(descQueue);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function() {
  setupSearch();

  // cache-bust so new/edited entries show up immediately instead of
  // waiting out the browser's or GitHub Pages' cache
  Papa.parse('Book Club - Books Read_ISBN.csv?cachebust=' + Date.now(), {
    download: true,
    header: true,
    complete: function(results) {
      var clean = results.data.filter(function(b) {
        return b['Title'] && b['Meeting Date'];
      });
      renderBooks(clean);
    }
  });
});
