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
        backgroundColor: [
          '#d8a48f', '#f4c2c2', '#ffb6c1', '#ff69b4', '#ff1493', '#db7093', '#c71585', '#e6e6fa', '#dda0dd', '#ee82ee'
        ],
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
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}



window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read_ISBN_Genres_Updated.csv", {
    download: true,
    header: true,
    complete: function(results) {
      const data = results.data;
      generateChart(data, 'Major Genre', 'Books by Major Genre', 'genreChart');
      generateChart(data, 'Sub-Genre', 'Books by Sub-Genre', 'subgenreChart');
    }
  });
});
