function getMeetingYear(dateString) {
  const date = new Date(dateString);
  return date.getFullYear();
}

const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';

// Fetch covers for a batch of ISBNs in ONE request using Google Dynamic Links API
// Returns a map of { isbn: thumbnailUrl }
async function fetchCoversForISBNs(isbns) {
  const unique = [...new Set(isbns.filter(Boolean))];
  if (!unique.length) return {};
  const bibkeys = unique.map(i => `ISBN:${i}`).join(',');
  const url = `https://books.google.com/books?bibkeys=${encodeURIComponent(bibkeys)}&jscmd=viewapi&callback=__gbcb`;

  return new Promise((resolve) => {
    const result = {};
    const timeout = setTimeout(() => resolve(result), 5000);

    window.__gbcb = function(data) {
      clearTimeout(timeout);
      for (const key in data) {
        const isbn = key.replace('ISBN:', '');
        if (data[key].thumbnail_url) {
          result[isbn] = data[key].thumbnail_url.replace('http://', 'https://');
        }
      }
      delete window.__gbcb;
      resolve(result);
    };

    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => { clearTimeout(timeout); resolve(result); };
    document.head.appendChild(script);
  });
}

async function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');

  // Group by year
  const booksByYear = {};
  for (const book of data) {
    const year = new Date(book['Meeting Date']).getFullYear();
    if (!booksByYear[year]) booksByYear[year] = [];
    booksByYear[year].push(book);
  }

  const years = Object.keys(booksByYear).sort().reverse();

  // Year jump links
  const yearLinksDiv = document.createElement('div');
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(y => `<a href="#year-${y}">${y}</a>`).join('');
  shelf.appendChild(yearLinksDiv);

  // Collect ALL ISBNs across all books and fetch covers in one batch
  const allISBNs = data.map(b => b.ISBN?.replace(/[^0-9Xx]/g, '')).filter(Boolean);
  const coverMap = await fetchCoversForISBNs(allISBNs);

  // Render each year section
  for (const year of years) {
    const section = document.createElement('section');
    section.id = `year-${year}`;
    section.innerHTML = `<h2>${year}</h2>`;

    const bookContainer = document.createElement('div');
    bookContainer.className = 'book-container';

    const booksInYear = [...booksByYear[year]].reverse();

    booksInYear.forEach((book, index) => {
      const isbn = book.ISBN?.replace(/[^0-9Xx]/g, '');
      const coverUrl = (isbn && coverMap[isbn]) ? coverMap[isbn] : FALLBACK;

      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-card fade-in';
      bookDiv.style.animationDelay = `${index * 0.06}s`;

      const img = document.createElement('img');
      img.src = coverUrl;
      img.alt = `Cover of ${book.Title}`;
      img.onerror = () => { img.onerror = null; img.src = FALLBACK; };

      const info = document.createElement('div');
      info.innerHTML = `
        <strong>${book.Title}</strong>
        <p>by ${book.Author}<br>
        Meeting: ${book['Meeting Date']}</p>
        <p><a href="${book['Goodreads URL']}" target="_blank">Goodreads ↗</a></p>
      `;

      bookDiv.appendChild(img);
      bookDiv.appendChild(info);
      bookContainer.appendChild(bookDiv);
    });

    section.appendChild(bookContainer);

    const backToTop = document.createElement('div');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = `<a href="#top">↑ Back to top</a>`;
    section.appendChild(backToTop);

    shelf.appendChild(section);
  }

  // Floating back-to-top button
  const topLink = document.createElement('a');
  topLink.href = '#top';
  topLink.id = 'top-link';
  topLink.textContent = '↑ Top';
  document.body.appendChild(topLink);

  window.addEventListener('scroll', () => {
    topLink.classList.toggle('show', window.scrollY > 400);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: function(results) {
      const cleanedData = results.data.filter(book => book['Title'] && book['Meeting Date']);
      renderBooks(cleanedData);
    }
  });
});
