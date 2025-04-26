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

  const backgroundColors = Object.keys(counts).map(label => stringToCozyColor(label));

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
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
          font: {
            size: 20
          }
        },
        legend: {
          position: 'bottom',
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}


window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: function(results) {
      const data = results.data.filter(book => book['Title']); // small cleanup to skip blank rows
      generateChart(data, 'Sub-Genre', 'Books by Sub-Genre', 'subgenreChart');
    }
  });
});

// adding functionality to click and display the books from the genre
document.querySelectorAll('.sub-genre').forEach(subGenre => {
    subGenre.addEventListener('click', function() {
        displayBooks(subGenre.dataset.genre);
    });
});

function displayBooks(genre) {
    // Fetch books from your data source
    fetch(`path/to/your/books/data?genre=${genre}`)
        .then(response => response.json())
        .then(data => {
            const booksContainer = document.getElementById('books-container');
            booksContainer.innerHTML = ''; // Clear previous books
            data.books.forEach(book => {
                const bookElement = document.createElement('div');
                bookElement.className = 'book';
                bookElement.innerHTML = `<h3>${book.title}</h3><p>${book.author}</p>`;
                booksContainer.appendChild(bookElement);
            });
        });
}
