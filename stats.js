function stringToCozyColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 60%, 70%)`;
}

function generateChart(data, label, title, elementId) {
  const ctx = document.getElementById(elementId).getContext('2d');
  const counts = {};

  data.forEach(book => {
    const value = book[label] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const backgroundColors = labels.map(l => stringToCozyColor(l));

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: `${label} Distribution`,
        data: Object.values(counts),
        backgroundColor: backgroundColors,
        borderColor: '#ffffff',
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 20 }
        },
        legend: {
          position: 'bottom',
          onClick: function(event, legendItem) {
            displayBooks(legendItem.text);
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';
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

async function displayBooks(genre) {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: async function(results) {
      const booksContainer = document.getElementById('books-container');
      booksContainer.innerHTML = '';

      const filteredBooks = results.data.filter(book => book['Sub-Genre'] === genre);

      const subHeader = document.createElement('h2');
      subHeader.className = 'sub-header';
      subHeader.innerHTML = `📚 ${genre} — ${filteredBooks.length} book${filteredBooks.length !== 1 ? 's' : ''}`;
      booksContainer.appendChild(subHeader);

      if (filteredBooks.length === 0) {
        booksContainer.innerHTML += `<p>No books found in the sub-genre: ${genre}</p>`;
        return;
      }

      const bookContainer = document.createElement('div');
      bookContainer.className = 'book-container';

      // Build all cards first so layout is stable, then fill covers
      const coverFetches = filteredBooks.map((book, index) => {
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

        return isbn
          ? getGoogleBooksCover(isbn).then(url => { if (url) img.src = url; })
          : Promise.resolve();
      });

      booksContainer.appendChild(bookContainer);

      // Fetch all covers in parallel
      await Promise.all(coverFetches);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: function(results) {
      const data = results.data.filter(book => book['Title']);
      generateChart(data, 'Sub-Genre', 'Books by Sub-Genre', 'subgenreChart');
    }
  });
});
