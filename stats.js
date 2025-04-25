// stats.js
function groupByGenre(data) {
  const genreCount = {};
  data.forEach(book => {
    const genre = book.Genre?.trim();
    if (genre) {
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    }
  });
  return genreCount;
}

function renderChart(genreData) {
  const ctx = document.getElementById('genreChart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(genreData),
      datasets: [{
        label: 'Books by Genre',
        data: Object.values(genreData),
        backgroundColor: [
          '#f9c6c9', '#cdeac0', '#f7d794', '#d3c0f9', '#b8e0f2', '#f6a6b2'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        },
        title: {
          display: true,
          text: 'Distribution of Book Genres'
        }
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse('Book Club - Books Read_ISBN.csv', {
    download: true,
    header: true,
    complete: function(results) {
      const genreData = groupByGenre(results.data);
      renderChart(genreData);
    }
  });
});
