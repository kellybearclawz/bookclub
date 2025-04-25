function renderChart(data) {
  const genreCounts = {};
  data.forEach(book => {
    const genre = book.Genre.trim();
    if (genre) {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
  });

  const ctx = document.getElementById('genreChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(genreCounts),
      datasets: [{
        label: 'Books per Genre',
        data: Object.values(genreCounts),
        backgroundColor: '#bfa87a',
        borderColor: '#7e6a53',
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN.csv", {
    download: true,
    header: true,
    complete: function(results) {
      renderChart(results.data);
    }
  });
});
