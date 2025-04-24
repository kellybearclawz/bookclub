function renderBooks(data) {
  const shelf = document.getElementById('bookshelf');
  data.forEach(book => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'flex-start';
    div.style.gap = '1rem';
    div.innerHTML = `
      <img src="${book.Cover}" alt="Cover of ${book.Title}" style="width: 80px; height: auto; border-radius: 6px;" />
      <div>
        <p><strong>${book.Title}</strong><br>
        by ${book.Author}<br>
        Genre: ${book.Genre}<br>
        Meeting: ${book['Meeting Date']}</p>
      </div>
    `;
    shelf.appendChild(div);
  });
}
