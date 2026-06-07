// ─── Constants ───────────────────────────────────────────────────────────────
const CONSOLE_ORDER = [
  'GB/GBC','GBA','NDS','3DS','PSP','PS Vita',
  'NES','SNES','Mega Drive','N64','Saturn','Dreamcast','PS1','PS2','GameCube','PC',
];

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

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  games:   [],
  stats:   null,
  filters: { console: '', statut: '', search: '' },
  sortBy:  'metacritic',
  modal:   { open: false, mode: 'edit', game: null, statut: null, note: null },
};

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadGames(), loadStats()]);
  populateConsoleSelect();
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

function populateConsoleSelect() {
  const sel = document.getElementById('add-console');
  sel.innerHTML = '<option value="">— Choisir —</option>' +
    CONSOLE_ORDER.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ─── Filtering & sorting ─────────────────────────────────────────────────────
function filteredGames() {
  const { console: con, statut, search } = state.filters;
  let list = state.games;

  if (con)    list = list.filter(g => g.console === con);
  if (statut) list = list.filter(g => g.statut === statut);
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

// ─── Rendering ───────────────────────────────────────────────────────────────
function render() {
  renderStats();
  renderConsoleFilters();
  renderGames(filteredGames());
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
    <span>Toutes</span><span class="count">${state.stats.total}</span>
  </button>`;

  const buttons = CONSOLE_ORDER
    .filter(c => state.stats.byConsole[c])
    .map(c => {
      const d   = state.stats.byConsole[c];
      const active = state.filters.console === c ? 'active' : '';
      const col = CONSOLE_COLORS[c] || { color: '#aaa' };
      const dot = `<span style="width:8px;height:8px;border-radius:50%;background:${col.color};display:inline-block;flex-shrink:0"></span>`;
      return `<button class="filter-btn ${active}" data-console="${c}">
        ${dot}<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${c}</span>
        <span class="count">${d.total}</span>
      </button>`;
    });

  container.innerHTML = allBtn + buttons.join('');
  container.querySelectorAll('[data-console]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.console = btn.dataset.console;
      render();
    });
  });
}

function renderGames(games) {
  const body  = document.getElementById('list-body');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${games.length} jeu${games.length !== 1 ? 'x' : ''}`;

  if (games.length === 0) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  body.innerHTML = games.map(renderRow).join('');

  body.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => {
      const game = state.games.find(g => g.id === row.dataset.id);
      if (game) openModal(game);
    });
  });
}

function consoleBadgeHtml(con) {
  const col = CONSOLE_COLORS[con] || { bg: '#555', color: '#eee' };
  return `<span class="console-badge" style="background:${col.bg};color:${col.color}">${escHtml(con)}</span>`;
}

function mcHtml(mc) {
  if (!mc) return '<span class="col-mc-empty">—</span>';
  const cls = mc >= 85 ? 'mc-good' : mc >= 70 ? 'mc-ok' : 'mc-meh';
  return `<span class="tag tag-mc ${cls}">MC ${mc}</span>`;
}

function renderRow(game) {
  const s        = STATUS_CONFIG[game.statut] || STATUS_CONFIG.todo;
  const noteHtml = game.note
    ? `<span class="row-note">★ ${game.note}</span>`
    : '<span class="row-empty">—</span>';

  return `<div class="list-row status-${game.statut}" data-id="${game.id}">
    <div class="col-title">${escHtml(game.titre)}</div>
    <div class="col-console">${consoleBadgeHtml(game.console)}</div>
    <div class="col-genre">${escHtml(game.genre) || '<span class="row-empty">—</span>'}</div>
    <div class="col-mc">${mcHtml(game.metacritic)}</div>
    <div class="col-duree">${game.duree ? escHtml(game.duree) : '<span class="row-empty">—</span>'}</div>
    <div class="col-note">${noteHtml}</div>
    <div class="col-status" title="${s.label}">${s.icon}</div>
  </div>`;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function openModal(game) {
  state.modal = { open: true, mode: 'edit', game, statut: game.statut, note: game.note };
  renderModal();
  document.getElementById('modal').classList.remove('hidden');
}

function openAddModal() {
  state.modal = { open: true, mode: 'add', game: null, statut: 'todo', note: null };
  renderModal();
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('add-titre').focus();
}

function closeModal() {
  state.modal = { open: false, mode: 'edit', game: null, statut: null, note: null };
  document.getElementById('modal').classList.add('hidden');
}

function renderModal() {
  const { mode, game, statut, note } = state.modal;
  const isAdd = mode === 'add';

  document.getElementById('modal-edit-info').classList.toggle('hidden', isAdd);
  document.getElementById('add-fields').classList.toggle('hidden', !isAdd);
  document.getElementById('modal-badge').classList.toggle('hidden', isAdd);
  document.getElementById('modal-save').textContent = isAdd ? 'Ajouter' : 'Enregistrer';

  if (isAdd) {
    document.getElementById('modal-title').textContent = 'Ajouter un jeu';
    document.getElementById('add-titre').value   = '';
    document.getElementById('add-console').value = '';
    document.getElementById('add-genre').value   = '';
    document.getElementById('add-mc-input').value = '';
    document.getElementById('add-duree').value   = '';
  } else {
    document.getElementById('modal-title').textContent = game.titre;

    const col   = CONSOLE_COLORS[game.console] || { bg: '#555', color: '#eee' };
    const badge = document.getElementById('modal-badge');
    badge.textContent      = game.console;
    badge.style.background = col.bg;
    badge.style.color      = col.color;

    document.getElementById('modal-genre').textContent = game.genre;
    document.getElementById('modal-genre').className   = 'tag';

    const mcEl = document.getElementById('modal-mc');
    if (game.metacritic) {
      const cls = game.metacritic >= 85 ? 'mc-good' : game.metacritic >= 70 ? 'mc-ok' : 'mc-meh';
      mcEl.textContent = `Metacritic ${game.metacritic}`;
      mcEl.className   = `tag tag-mc ${cls}`;
    } else {
      mcEl.textContent = '';
      mcEl.className   = 'tag tag-mc';
    }

    const dureeEl = document.getElementById('modal-duree');
    dureeEl.textContent = game.duree ? `⏱ ${game.duree}` : '';
    dureeEl.className   = 'tag tag-muted';

    const anneeEl = document.getElementById('modal-annee');
    anneeEl.textContent = game.annee ? `📅 ${game.annee}` : '';
    anneeEl.className   = game.annee ? 'tag tag-muted' : 'hidden';

    document.getElementById('modal-desc').textContent = game.notes || '';
  }

  // Statut (commun)
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

  renderStars(note);
}

function renderStars(current) {
  const row     = document.getElementById('stars-row');
  const display = document.getElementById('rating-display');

  row.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.className   = 'star' + (current && i <= current ? ' lit' : '');
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
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < n));
}

async function saveModal() {
  if (state.modal.mode === 'add') {
    await saveNewGame();
  } else {
    await saveEditGame();
  }
}

async function saveEditGame() {
  const { game, statut, note } = state.modal;
  try {
    const res = await fetch(`/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut, note }),
    });
    if (!res.ok) throw new Error('Server error');
    const updated = await res.json();
    const idx = state.games.findIndex(g => g.id === game.id);
    if (idx !== -1) state.games[idx] = updated;
    await loadStats();
    closeModal();
    render();
  } catch (err) {
    console.error(err);
    alert('Erreur lors de la sauvegarde.');
  }
}

async function saveNewGame() {
  const titre = document.getElementById('add-titre').value.trim();
  const con   = document.getElementById('add-console').value;

  if (!titre) { document.getElementById('add-titre').focus();   return; }
  if (!con)   { document.getElementById('add-console').focus(); return; }

  const body = {
    titre,
    console:    con,
    genre:      document.getElementById('add-genre').value.trim(),
    metacritic: parseInt(document.getElementById('add-mc-input').value) || null,
    duree:      document.getElementById('add-duree').value.trim(),
    statut:     state.modal.statut || 'todo',
    note:       state.modal.note   || null,
  };

  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Server error');
    const newGame = await res.json();
    state.games.push(newGame);
    await loadStats();
    closeModal();
    render();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'ajout.");
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────
function bindEvents() {
  const searchEl = document.getElementById('search');
  searchEl.addEventListener('input', () => {
    state.filters.search = searchEl.value;
    render();
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    state.sortBy = e.target.value;
    render();
  });

  document.getElementById('status-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-statut]');
    if (!btn) return;
    state.filters.statut = btn.dataset.statut;
    syncStatusButtons();
    render();
  });

  document.getElementById('stats-bar').addEventListener('click', e => {
    const item = e.target.closest('[data-filter]');
    if (!item) return;
    state.filters.statut = item.dataset.filter === 'all' ? '' : item.dataset.filter;
    syncStatusButtons();
    render();
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  document.getElementById('btn-add').addEventListener('click', openAddModal);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.modal.open) closeModal();
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
