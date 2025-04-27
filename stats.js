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
    const backgroundColors = labels.map(label => stringToCozyColor(label));

    const chart = new Chart(ctx, {
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
                    font: {
                        size: 20
                    }
                },
                legend: {
                    position: 'bottom',
                    onClick: function(event, legendItem) {
                        const genre = legendItem.text;
                        displayBooks(genre);
                    }
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

async function displayBooks(genre) {
    Papa.parse("Book Club - Books Read_ISBN.csv", {
        download: true,
        header: true,
        complete: async function(results) {
            const booksContainer = document.getElementById('books-container');
            booksContainer.innerHTML = ''; // Clear previous books
            const filteredBooks = results.data.filter(book => book['Sub-Genre'] === genre);

            if (filteredBooks.length === 0) {
                booksContainer.innerHTML = `<p>No books found in the subgenre: ${genre}</p>`;
                return;
            }

            const bookContainer = document.createElement('div');
            bookContainer.className = 'book-container'; // same as your bookshelf layout

            filteredBooks.forEach((book, index) => {
            const bookDiv = document.createElement('div');
            bookDiv.className = 'book-card fade-in';
            bookDiv.style.animationDelay = `${index * 0.1}s`; // <--- stagger each by 0.1s
            bookDiv.innerHTML = `
              <img src="..." alt="..." />
              <div>
                <p><strong>${book.Title}</strong><br>
                by ${book.Author}<br>
                Meeting: ${book['Meeting Date']}<br>
                <a href="${book['Goodreads URL']}" target="_blank">Goodreads URL</a></p>
              </div>
            `;
            booksContainer.appendChild(bookDiv);
            }
    );
}
