function stringToCozyColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 68%)`;
}

function generateChart(data, label, title, elementId) {
  const ctx = document.getElementById(elementId).getContext('2d');
  const counts = {};
  data.forEach(book => {
    const value = book[label] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  const labels = Object.keys(counts).sort();
  const backgroundColors = labels.map(l => stringToCozyColor(l));

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        label: `${label} Distribution`,
        data: labels.map(l => counts[l]),
        backgroundColor: backgroundColors,
        borderColor: '#fffdf9',
        borderWidth: 2,
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18, family: "'Lora', Georgia, serif" },
          color: '#5e3d1e',
          padding: { bottom: 16 },
        },
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 13 },
            color: '#3a2a1a',
            padding: 14,
            usePointStyle: true,
          },
          onClick: function(event, legendItem) {
            displayBooks(legendItem.text);
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';
const coverCache = {};
const FALLBACK = 'https://kellybearclawz.github.io/bookclub/default-cover.jpg';

async function getGoogleBooksCover(isbn) {
  if (!isbn) return null;
  if (coverCache[isbn] !== undefined) return coverCache[isbn];
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const volumeId = data.items[0].id;
      if (volumeId) {
        // Build cover URL directly from volume ID — avoids http/https and edge=curl issues
        const url = `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=2&source=gbs_api`;
        coverCache[isbn] = url;
        return url;
      }
    }
  } catch {}
  coverCache[isbn] = null;
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
        booksContainer.innerHTML += `<p style="text-align:center">No books found in: ${genre}</p>`;
        return;
      }

      const bookContainer = document.createElement('div');
      bookContainer.className = 'book-container';

      const coverFetches = filteredBooks.map((book, index) => {
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

      booksContainer.appendChild(bookContainer);
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
