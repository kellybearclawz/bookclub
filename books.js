function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');
  data.forEach(book => {
    const div = document.createElement('div');
    div.style.marginBottom = '1rem';
    div.innerHTML = `<p><strong>${book.Title}</strong><br>by ${book.Author}<br>Genre: ${book.Genre}<br>Meeting: ${book['Meeting Date']}</p>`;
    shelf.appendChild(div);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Papa.parse("Book Club - Books Read.csv", {
    download: true,
    header: true,
    complete: function(results) {
      renderBooks(results.data);
    }
  });
});
