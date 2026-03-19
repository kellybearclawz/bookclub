function getMeetingYear(dateString) {
  const date = new Date(dateString);
  return date.getFullYear();
}

// Cache so we don't re-fetch the same ISBN twice across the page
const coverCache = {};

async function getGoogleBooksCover(isbn) {
  if (!isbn) return null;
  if (coverCache[isbn]) return coverCache[isbn];
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const links = data.items[0].volumeInfo.imageLinks;
      if (links) {
        // Prefer the largest available, bump zoom for a crisper image
        const url = (links.thumbnail || links.smallThumbnail || '')
          .replace('zoom=1', 'zoom=2')
          .replace('http://', 'https://');
        coverCache[isbn] = url;
        return url;
      }
    }
  } catch {}
  return null;
}

const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';

async function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');

  // Group books by meeting year
  const booksByYear = {};
  for (const book of data) {
    const year = getMeetingYear(book['Meeting Date']);
    if (!booksByYear[year]) booksByYear[year] = [];
    booksByYear[year].push(book);
  }

  // Year jump links
  const years = Object.keys(booksByYear).sort().reverse();
  const yearLinksDiv = document.createElement('div');
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(y => `<a href="#year-${y}">${y}</a>`).join(' | ');
  shelf.appendChild(yearLinksDiv);

  // Render each year section — build DOM first, then fill covers async
  for (const year of years) {
    const section = document.createElement('section');
    section.id = `year-${year}`;
    section.innerHTML = `<h2>${year}</h2>`;

    const bookContainer = document.createElement('div');
    bookContainer.className = 'book-container';

    const booksInYear = [...booksByYear[year]].reverse();

    // Create all cards immediately so layout is stable
    const coverFetches = booksInYear.map((book, index) => {
      const isbn = book.ISBN?.replace(/[^0-9Xx]/g, '');
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-card fade-in';
      bookDiv.style.animationDelay = `${index * 0.1}s`;

      const img = document.createElement('img');
      img.src = FALLBACK;
      img.alt = `Cover of ${book.Title}`;
      img.onerror = () => { img.onerror = null; img.src = FALLBACK; };

      bookDiv.innerHTML = `
        <div>
          <p><strong>${book.Title}</strong><br>
          by ${book.Author}<br>
          Meeting: ${book['Meeting Date']}</p>
          <p><a href="${book['Goodreads URL']}" target="_blank">Goodreads Link</a></p>
        </div>
      `;
      bookDiv.prepend(img);
      bookContainer.appendChild(bookDiv);

      // Return a promise that fills the cover when ready
      return isbn
        ? getGoogleBooksCover(isbn).then(url => { if (url) img.src = url; })
        : Promise.resolve();
    });

    section.appendChild(bookContainer);

    const backToTop = document.createElement('div');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = `<a href="#top">↑ Back to Top ↑</a>`;
    section.appendChild(backToTop);

    shelf.appendChild(section);

    // Fetch all covers for this year in parallel
    await Promise.all(coverFetches);
  }

  const topLink = document.createElement('div');
  topLink.innerHTML = `<a href="#top" id="top-link">↑ Back to Top ↑</a>`;
  shelf.appendChild(topLink);
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
