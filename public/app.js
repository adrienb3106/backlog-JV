// ─── Console colour palette ─────────────────────────────────────────────────
const CONSOLE_COLORS = {
  'GB/GBC':    { bg: '#78350f', color: '#fde68a' },
  'GBA':       { bg: '#4c1d95', color: '#ddd6fe' },
  'NDS':       { bg: '#1e3a5f', color: '#93c5fd' },
  '3DS':       { bg: '#7f1d1d', color: '#fca5a5' },
  'PSP':       { bg: '#134e4a', color: '#5eead4' },
  'PS Vita':   { bg: '#0e4f64', color: '#67e8f9' },
  'NES':       { bg: '#374151', color: '#d1d5db' },
  'SNES':      { bg: '#3b0764', color: '#e9d5ff' },
  'Mega Drive':{ bg: '#1e3a5f', color: '#a5b4fc' },
  'N64':       { bg: '#7c2d12', color: '#fed7aa' },
  'Saturn':    { bg: '#14532d', color: '#86efac' },
  'Dreamcast': { bg: '#7c1d1d', color: '#fca5a5' },
  'PS1':       { bg: '#312e81', color: '#c7d2fe' },
  'PS2':       { bg: '#1e3656', color: '#93c5fd' },
  'GameCube':  { bg: '#4a1d96', color: '#c4b5fd' },
  'PC':        { bg: '#14532d', color: '#86efac' },
};

const STATUS_CONFIG = {
  todo:    { icon: '⬜', label: 'À faire',   color: '#94a3b8' },
  done:    { icon: '✅', label: 'Terminé',   color: '#22c55e' },
  replay:  { icon: '🔄', label: 'À refaire', color: '#3b82f6' },
  paused:  { icon: '⏸️', label: 'En pause',  color: '#f59e0b' },
  dropped: { icon: '❌', label: 'Abandonné', color: '#ef4444' },
};

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  games:   [],
  stats:   null,
  filters: { console: '', categorie: '', statut: '', search: '' },
  sortBy:  'metacritic',
  modal:   { open: false, game: null, statut: null, note: null },
};

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadGames(), loadStats()]);
  bindEvents();
  render();
}

async function loadGames() {
  const res = await fetch('/api/games');
  state.games = await res.json();
}

async function loadStats() {
  const res = await fetch('/api/stats');
  state.stats = await res.json();
}

// ─── Filtering & sorting ────────────────────────────────────────────────────
function filteredGames() {
  const { console: con, categorie, statut, search } = state.filters;
  let list = state.games;

  if (con)      list = list.filter(g => g.console === con);
  if (categorie) list = list.filter(g => g.categorie === categorie);
  if (statut)   list = list.filter(g => g.statut === statut);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(g => g.titre.toLowerCase().includes(q));
  }

  return sortGames(list);
}

function sortGames(list) {
  const copy = [...list];
  switch (state.sortBy) {
    case 'titre':
      copy.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
      break;
    case 'metacritic':
      copy.sort((a, b) => (b.metacritic || 0) - (a.metacritic || 0));
      break;
    case 'note':
      copy.sort((a, b) => (b.note || 0) - (a.note || 0));
      break;
    case 'duree':
      copy.sort((a, b) => parseDuration(a.duree) - parseDuration(b.duree));
      break;
  }
  return copy;
}

function parseDuration(str) {
  if (!str || str === '∞' || str === '—') return 9999;
  const m = str.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function render() {
  renderStats();
  renderConsoleFilters();
  const games = filteredGames();
  renderGames(games);
}

function renderStats() {
  if (!state.stats) return;
  const s = state.stats;
  document.getElementById('stat-total').textContent  = s.total;
  document.getElementById('stat-todo').textContent   = s.todo;
  document.getElementById('stat-done').textContent   = s.done;
  document.getElementById('stat-replay').textContent = s.replay;
  document.getElementById('stat-paused').textContent = s.paused;
}

function renderConsoleFilters() {
  if (!state.stats) return;
  const container = document.getElementById('console-filters');

  const allBtn = `<button class="filter-btn ${!state.filters.console ? 'active' : ''}" data-console="">
    <span>Toutes</span>
    <span class="count">${state.stats.total}</span>
  </button>`;

  const CONSOLE_ORDER = [
    'GB/GBC','GBA','NDS','3DS','PSP','PS Vita',
    'NES','SNES','Mega Drive','N64','Saturn','Dreamcast','PS1','PS2','GameCube','PC'
  ];

  const buttons = CONSOLE_ORDER
    .filter(c => state.stats.byConsole[c])
    .map(c => {
      const d = state.stats.byConsole[c];
      const active = state.filters.console === c ? 'active' : '';
      const col = CONSOLE_COLORS[c] || { bg: '#333', color: '#ccc' };
      const dot = `<span style="width:8px;height:8px;border-radius:50%;background:${col.color};display:inline-block;flex-shrink:0"></span>`;
      return `<button class="filter-btn ${active}" data-console="${c}">
        ${dot} <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${c}</span>
        <span class="count">${d.total}</span>
      </button>`;
    });

  container.innerHTML = allBtn + buttons.join('');

  container.querySelectorAll('[data-console]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.console = btn.dataset.console;
      state.filters.categorie = '';
      syncCatButtons();
      render();
    });
  });
}

function renderGames(games) {
  const grid = document.getElementById('games-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${games.length} jeu${games.length !== 1 ? 'x' : ''}`;

  if (games.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = games.map(renderCard).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const game = state.games.find(g => g.id === id);
      if (game) openModal(game);
    });
  });
}

function consoleBadgeHtml(con) {
  const col = CONSOLE_COLORS[con] || { bg: '#333', color: '#ccc' };
  return `<span class="console-badge" style="background:${col.bg};color:${col.color}">${con}</span>`;
}

function mcTagHtml(mc) {
  if (!mc) return '';
  const cls = mc >= 85 ? 'mc-good' : mc >= 70 ? 'mc-ok' : 'mc-meh';
  return `<span class="tag tag-mc ${cls}">MC ${mc}</span>`;
}

function renderCard(game) {
  const s = STATUS_CONFIG[game.statut] || STATUS_CONFIG.todo;
  const noteHtml = game.note
    ? `<span class="card-note">★ ${game.note}</span>` : '';
  const descHtml = game.notes
    ? `<div class="card-desc">${escHtml(game.notes)}</div>` : '';

  return `<div class="card status-${game.statut}" data-id="${game.id}">
    <div class="card-top">
      <div class="card-title">${escHtml(game.titre)}</div>
      <span class="card-status" title="${s.label}">${s.icon}</span>
    </div>
    ${noteHtml}
    <div class="card-meta">
      ${consoleBadgeHtml(game.console)}
      <span class="tag">${escHtml(game.genre)}</span>
      ${mcTagHtml(game.metacritic)}
      ${game.duree ? `<span class="tag tag-muted">⏱ ${escHtml(game.duree)}</span>` : ''}
    </div>
    ${descHtml}
  </div>`;
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function openModal(game) {
  state.modal = { open: true, game, statut: game.statut, note: game.note };
  renderModal();
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  state.modal = { open: false, game: null, statut: null, note: null };
  document.getElementById('modal').classList.add('hidden');
}

function renderModal() {
  const { game, statut, note } = state.modal;

  document.getElementById('modal-title').textContent = game.titre;

  // Badge
  const col = CONSOLE_COLORS[game.console] || { bg: '#333', color: '#ccc' };
  const badge = document.getElementById('modal-badge');
  badge.textContent = game.console;
  badge.style.background = col.bg;
  badge.style.color = col.color;

  // Meta tags
  document.getElementById('modal-genre').textContent = game.genre;
  document.getElementById('modal-genre').className = 'tag';

  const mcEl = document.getElementById('modal-mc');
  if (game.metacritic) {
    const cls = game.metacritic >= 85 ? 'mc-good' : game.metacritic >= 70 ? 'mc-ok' : 'mc-meh';
    mcEl.textContent = `Metacritic ${game.metacritic}`;
    mcEl.className = `tag tag-mc ${cls}`;
  } else {
    mcEl.textContent = '';
    mcEl.className = 'tag tag-mc';
  }

  const dureeEl = document.getElementById('modal-duree');
  dureeEl.textContent = game.duree ? `⏱ ${game.duree}` : '';
  dureeEl.className = 'tag tag-muted';

  const anneeEl = document.getElementById('modal-annee');
  anneeEl.textContent = game.annee ? `📅 ${game.annee}` : '';
  anneeEl.className = game.annee ? 'tag tag-muted' : 'hidden';

  document.getElementById('modal-desc').textContent = game.notes || '';

  // Status buttons
  const grid = document.getElementById('modal-status-grid');
  grid.innerHTML = Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
    const active = statut === key ? 'active' : '';
    return `<button class="status-btn ${active}" data-status="${key}">
      <span class="s-icon">${cfg.icon}</span>
      <span>${cfg.label}</span>
    </button>`;
  }).join('');

  grid.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.modal.statut = btn.dataset.status;
      grid.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Stars rating
  renderStars(note);
}

function renderStars(current) {
  const row = document.getElementById('stars-row');
  const display = document.getElementById('rating-display');
  const MAX = 10;

  row.innerHTML = '';
  for (let i = 1; i <= MAX; i++) {
    const star = document.createElement('span');
    star.className = 'star' + (current && i <= current ? ' lit' : '');
    star.textContent = '★';
    star.dataset.val = i;

    star.addEventListener('mouseenter', () => highlightStars(i));
    star.addEventListener('mouseleave', () => highlightStars(state.modal.note || 0));
    star.addEventListener('click', () => {
      state.modal.note = state.modal.note === i ? null : i;
      renderStars(state.modal.note);
    });
    row.appendChild(star);
  }

  display.textContent = current ? `${current}/10` : '—';
}

function highlightStars(n) {
  document.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('lit', i < n);
  });
}

async function saveModal() {
  const { game, statut, note } = state.modal;
  try {
    const res = await fetch(`/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut, note }),
    });
    if (!res.ok) throw new Error('Server error');
    const updated = await res.json();

    // Update local state
    const idx = state.games.findIndex(g => g.id === game.id);
    if (idx !== -1) state.games[idx] = updated;

    // Refresh stats
    await loadStats();
    closeModal();
    render();
  } catch (err) {
    console.error(err);
    alert('Erreur lors de la sauvegarde.');
  }
}

// ─── Event bindings ─────────────────────────────────────────────────────────
function bindEvents() {
  // Search
  const searchEl = document.getElementById('search');
  searchEl.addEventListener('input', () => {
    state.filters.search = searchEl.value;
    render();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    state.sortBy = e.target.value;
    render();
  });

  // Category filters
  document.getElementById('cat-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.filters.categorie = btn.dataset.cat;
    state.filters.console = '';
    syncCatButtons();
    render();
  });

  // Status filters
  document.getElementById('status-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-statut]');
    if (!btn) return;
    state.filters.statut = btn.dataset.statut;
    syncStatusButtons();
    render();
  });

  // Stats bar click (filter by status)
  document.getElementById('stats-bar').addEventListener('click', e => {
    const item = e.target.closest('[data-filter]');
    if (!item) return;
    const f = item.dataset.filter;
    state.filters.statut = f === 'all' ? '' : f;
    syncStatusButtons();
    render();
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.modal.open) closeModal();
  });
}

function syncCatButtons() {
  document.querySelectorAll('#cat-filters [data-cat]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === state.filters.categorie);
  });
}

function syncStatusButtons() {
  document.querySelectorAll('#status-filters [data-statut]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.statut === state.filters.statut);
  });
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Boot ────────────────────────────────────────────────────────────────────
init();
