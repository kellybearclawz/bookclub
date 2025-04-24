async function fetchCover(title, author) {
  const query = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
  try {
    const res = await fetch(query);
    const data = await res.json();
    const coverId = data.docs[0]?.cover_i;
    if (coverId) {
      return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    } else {
      return 'default-cover.jpg'; // fallback image in case no cover found
    }
  } catch (e) {
    console.error("Cover fetch failed", e);
    return 'default-cover.jpg';
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
