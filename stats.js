// stats.js

function generateChart(data, label, title, elementId) {
  const ctx = document.getElementById(elementId).getContext('2d');
  const counts = {};
  data.forEach(book => {
    const value = book[label] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        label: `${label} Distribution`,
        data: Object.values(counts),
        backgroundColor: '#d8a48f',
        borderRadius: 5
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
        }
      },
      responsive: true,
      scales: {
        x: {
          ticks: {
            color: '#5c4033'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#5c4033'
          }
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
      const data = results.data;
      generateChart(data, 'Genre', 'Books by Genre', 'genreChart');
      generateChart(data, 'Sub-Genre', 'Books by Sub-Genre', 'subgenreChart');
    }
  });
});
