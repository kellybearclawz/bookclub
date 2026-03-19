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

      var img = document.createElement('img');
      img.src = coverUrl;
      img.alt = 'Cover of ' + book.Title;
      img.onerror = function() { this.onerror = null; this.src = FALLBACK; };

      var info = document.createElement('div');
      var strong = document.createElement('strong');
      strong.textContent = book.Title;
      var details = document.createElement('p');
      details.innerHTML = 'by ' + book.Author + '<br>Meeting: ' + book['Meeting Date'];
      var linkP = document.createElement('p');
      var a = document.createElement('a');
      a.href = book['Goodreads URL'];
      a.target = '_blank';
      a.textContent = 'Goodreads ↗';
      linkP.appendChild(a);
      info.appendChild(strong);
      info.appendChild(details);
      info.appendChild(linkP);

      bookDiv.appendChild(img);
      bookDiv.appendChild(info);
      bookContainer.appendChild(bookDiv);
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
}

// ─── Entry point ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function() {
  Papa.parse('Book Club - Books Read_ISBN.csv', {
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
