async function fetchCover(isbn) {
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
  } else {
    return 'default-cover.jpg'; // fallback image in case no ISBN is provided
  }
}

async function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');
  for (const book of data) {
    const coverUrl = await fetchCover(book.Title, book.Author);
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'flex-start';
    div.style.gap = '1rem';
    div.innerHTML = `
      <img src="${coverUrl}" alt="Cover of ${book.Title}" style="width: 80px; height: auto; border-radius: 6px;" />
      <div>
        <p><strong>${book.Title}</strong><br>
        by ${book.Author}<br>
        Genre: ${book.Genre}<br>
        Meeting: ${book['Meeting Date']}</p>
      </div>
    `;
    shelf.appendChild(div);
  }
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
