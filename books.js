function getMeetingYear(dateString) {
  const date = new Date(dateString);
  return date.getFullYear();
}

const coverCache = {};
const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';

async function getGoogleBooksCover(isbn) {
  if (!isbn) return null;
  if (coverCache[isbn]) return coverCache[isbn];
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const links = data.items[0].volumeInfo.imageLinks;
      if (links) {
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

async function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');

  const booksByYear = {};
  for (const book of data) {
    const year = getMeetingYear(book['Meeting Date']);
    if (!booksByYear[year]) booksByYear[year] = [];
    booksByYear[year].push(book);
  }

  const years = Object.keys(booksByYear).sort().reverse();

  // Year jump links
  const yearLinksDiv = document.createElement('div');
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(y => `<a href="#year-${y}">${y}</a>`).join('');
  shelf.appendChild(yearLinksDiv);

  for (const year of years) {
    const section = document.createElement('section');
    section.id = `year-${year}`;
    section.innerHTML = `<h2>${year}</h2>`;

    const bookContainer = document.createElement('div');
    bookContainer.className = 'book-container';

    const booksInYear = [...booksByYear[year]].reverse();

    const coverFetches = booksInYear.map((book, index) => {
      const isbn = book.ISBN?.replace(/[^0-9Xx]/g, '');

      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-card fade-in';
      bookDiv.style.animationDelay = `${index * 0.08}s`;

      const img = document.createElement('img');
      img.src = FALLBACK;
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

      return isbn
        ? getGoogleBooksCover(isbn).then(url => { if (url) img.src = url; })
        : Promise.resolve();
    });

    section.appendChild(bookContainer);

    const backToTop = document.createElement('div');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = `<a href="#top">↑ Back to top</a>`;
    section.appendChild(backToTop);

    shelf.appendChild(section);
    await Promise.all(coverFetches);
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
