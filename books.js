function getMeetingYear(dateString) {
  const date = new Date(dateString);
  return date.getFullYear();
}

function cleanISBN(isbn) {
  return isbn?.replace(/[^0-9Xx]/g, '');
}

async function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');

  // Group books by meeting year
  const booksByYear = {};
  for (const book of data) {
    const year = getMeetingYear(book['Meeting Date']);
    if (!booksByYear[year]) {
      booksByYear[year] = [];
    }
    booksByYear[year].push(book);
  }

  // Create jump links
  const years = Object.keys(booksByYear).sort().reverse();
  const yearLinksDiv = document.createElement('div');
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(y => `<a href="#year-${y}">${y}</a>`).join(' | ');
  shelf.appendChild(yearLinksDiv);

  // Render each year's section
  for (const year of years) {
    const section = document.createElement('section');
    section.id = `year-${year}`;
    section.innerHTML = `<h2>${year}</h2>`;

    const bookContainer = document.createElement('div');
    bookContainer.className = 'book-container';

    booksByYear[year].forEach((book, index) => {
      const isbn = cleanISBN(book.ISBN);
      const coverUrl = isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
        : 'https://kellybearclawz.github.io//bookclub/default-cover.jpg';

      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-card fade-in';
      bookDiv.style.animationDelay = `${index * 0.1}s`;

      bookDiv.innerHTML = `
        <img src="${coverUrl}" alt="Cover of ${book.Title}" onerror="this.onerror=null;this.src='https://via.placeholder.com/128x193.png?text=No+Cover';" />
        <div>
          <p><strong>${book.Title}</strong><br>
          by ${book.Author}<br>
          Meeting: ${book['Meeting Date']}</p>
          <p><a href="${book['Goodreads URL']}" target="_blank">Goodreads Link</a></p>
        </div>
      `;
      bookContainer.appendChild(bookDiv);
    });

    section.appendChild(bookContainer);

    // Add "Back to Top" link under each section
    const backToTop = document.createElement('div');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = `<a href="#top">↑ Back to Top ↑</a>`;
    section.appendChild(backToTop);

    shelf.appendChild(section);
  }

  // Add one last back to top link
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
