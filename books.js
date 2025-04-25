function getMeetingYear(dateString) {
  const date = new Date(dateString);
  return date.getFullYear();
}

async function fetchCover(isbn) {
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
  } else {
    return 'default-cover.jpg'; // fallback image in case no ISBN is provided
  }
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
  const years = Object.keys(booksByYear).sort();
  const yearLinksDiv = document.createElement('year-links'); // grabs the one already in your HTML
  yearLinksDiv.className = 'year-links';
  yearLinksDiv.innerHTML = years.map(y => `<a href="#year-${y}">${y}</a>`).join(' | ');
  shelf.appendChild(yearLinksDiv);

  // Render each year's section
  for (const year of years) {
    const section = document.createElement('section');
    section.id = `year-${year}`;
    section.innerHTML = `<h2>${year}</h2>`;
    
    for (const book of booksByYear[year]) {
      const coverUrl = await fetchCover(book.ISBN);
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-card';
      bookDiv.innerHTML = `
        <img src="${coverUrl}" alt="Cover of ${book.Title}" style="width: 80px; border-radius: 6px;" />
        <div>
          <p><strong>${book.Title}</strong><br>
          by ${book.Author}<br>
          Meeting: ${book['Meeting Date']}</p>
        </div>
      `;
      section.appendChild(bookDiv);
    }

    shelf.appendChild(section);
  }

  // Add back the "jump to top" link
  const topLink = document.createElement('div');
  topLink.innerHTML = `<a href="#top" id="top-link">↑ Back to Top</a>`;
  shelf.appendChild(topLink);
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: function(results) {
      renderBooks(results.data);
    }
  });
});

// Show/hide back to top button
const backToTopBtn = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    backToTopBtn.style.display = 'block';
  } else {
    backToTopBtn.style.display = 'none';
  }
});

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

