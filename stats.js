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

      // Fetch all covers for this genre in one batch
      const isbns = filteredBooks.map(b => b.ISBN?.replace(/[^0-9Xx]/g, '')).filter(Boolean);
      const coverMap = await fetchCoversForISBNs(isbns);

      const bookContainer = document.createElement('div');
      bookContainer.className = 'book-container';

      filteredBooks.forEach((book, index) => {
        const isbn = book.ISBN?.replace(/[^0-9Xx]/g, '');
        const coverUrl = (isbn && coverMap[isbn]) ? coverMap[isbn] : FALLBACK;

        const bookDiv = document.createElement('div');
        bookDiv.className = 'book-card fade-in';
        bookDiv.style.animationDelay = `${index * 0.08}s`;

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

      booksContainer.appendChild(bookContainer);
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
