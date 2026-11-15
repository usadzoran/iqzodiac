(() => {
  'use strict';
  const grid = document.querySelector('#movies-grid');
  const search = document.querySelector('#movies-search');
  const count = document.querySelector('#movies-count');
  let movies = [];
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = movies.filter((movie) => !query || [movie.title, ...(movie.genre || []), movie.year, movie.rating].join(' ').toLowerCase().includes(query));
    count.textContent = `${filtered.length} of ${movies.length} films`;
    if (!filtered.length) { grid.innerHTML = '<p class="movies-empty">No films matched your search.</p>'; return; }
    grid.innerHTML = filtered.map((movie) => `<article class="movie-card"><img class="movie-poster" src="${escapeHTML(movie.image || movie.big_image)}" alt="${escapeHTML(movie.title)} poster" loading="lazy" /><div class="movie-copy"><h2>${escapeHTML(movie.title)}</h2><div class="movie-meta"><span>${escapeHTML(movie.year)}</span><span>★ ${escapeHTML(movie.rating)}</span></div><div class="movie-genres">${(movie.genre || []).map((genre) => `<span class="movie-genre">${escapeHTML(genre)}</span>`).join('')}</div><p class="movie-description">${escapeHTML(movie.description)}</p><div class="movie-actions"><button type="button" data-expand>Details</button><a href="${escapeHTML(movie.imdb_link)}" target="_blank" rel="noopener noreferrer">IMDb ↗</a></div></div></article>`).join('');
  };
  search.addEventListener('input', render);
  grid.addEventListener('click', (event) => { const button = event.target.closest('[data-expand]'); if (button) button.closest('.movie-card').classList.toggle('is-expanded'); });
  fetch('./data/movies.json', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('movies_unavailable'); return response.json(); }).then((data) => { movies = Array.isArray(data) ? data : []; render(); }).catch(() => { count.textContent = 'Unavailable'; grid.innerHTML = '<p class="movies-empty">The movie collection could not be loaded.</p>'; });
})();
