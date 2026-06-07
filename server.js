const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'games.json');
const MARKDOWN_FILE = path.join(__dirname, 'backlog.md');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Markdown Parser ──────────────────────────────────────────────────────────

const CONSOLE_NAMES = {
  'Game Boy / Game Boy Color': 'GB/GBC',
  'Game Boy Advance (GBA)': 'GBA',
  'Nintendo DS': 'NDS',
  'Nintendo 3DS': '3DS',
  'PSP (PlayStation Portable)': 'PSP',
  'PlayStation Vita': 'PS Vita',
  'NES (Nintendo Entertainment System)': 'NES',
  'Super Nintendo (SNES)': 'SNES',
  'Mega Drive / Genesis': 'Mega Drive',
  'N64 (Nintendo 64)': 'N64',
  'Saturn (Sega Saturn)': 'Saturn',
  'Dreamcast': 'Dreamcast',
  'PlayStation (PS1)': 'PS1',
  'PlayStation 2': 'PS2',
  'GameCube': 'GameCube',
};


function stripLeadingEmoji(str) {
  return str
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{2600}-\u{27FF}⬛⚫️︎]+\s*/u, '')
    .replace(/^️\s*/, '')
    .trim();
}

function parseStatus(cell) {
  if (cell.includes('✅')) return 'done';
  if (cell.includes('🔄')) return 'replay';
  if (cell.includes('⏸')) return 'paused';
  if (cell.includes('❌')) return 'dropped';
  return 'todo';
}

function parseMC(cell) {
  const n = parseInt(cell, 10);
  return isNaN(n) ? null : n;
}

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 70);
}

function parseMarkdown(content) {
  const lines = content.split('\n');
  const games = [];
  const idSeen = {};
  let isPCSection = false;
  let currentConsole = '';
  let pcSubcategory = '';
  let inTable = false;
  let isPCTable = false;

  function uid(base) {
    if (!idSeen[base]) idSeen[base] = 0;
    idSeen[base]++;
    return idSeen[base] === 1 ? base : `${base}-${idSeen[base]}`;
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith('## ')) {
      isPCSection = line.includes('PC');
      inTable = false;
      continue;
    }

    if (line.startsWith('### ')) {
      inTable = false;
      const header = stripLeadingEmoji(line.slice(4));
      if (isPCSection) {
        currentConsole = 'PC';
        pcSubcategory = header.replace(/\s*\(PC\)\s*$/i, '').trim();
      } else {
        currentConsole = CONSOLE_NAMES[header] || header;
      }
      continue;
    }

    if (line === '---') { inTable = false; continue; }

    if (line.startsWith('| Titre |')) {
      inTable = true;
      isPCTable = line.includes('| Année |');
      continue;
    }

    if (inTable && /^\|[\s:\-|]+\|$/.test(line)) continue;

    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cols = line.split('|').slice(1, -1).map(c => c.trim());

      let game;
      if (isPCTable) {
        if (cols.length < 7) continue;
        // | Titre | Année | Genre | Statut | Note | MC | Durée | Notes |
        game = {
          id: uid(toSlug(`pc-${cols[0]}`)),
          titre: cols[0],
          console: 'PC',
          pcGenre: pcSubcategory,
          annee: parseInt(cols[1], 10) || null,
          genre: cols[2],
          statut: parseStatus(cols[3]),
          note: parseFloat(cols[4]) || null,
          metacritic: parseMC(cols[5]),
          duree: cols[6] || '',
          notes: cols[7] || '',
        };
      } else {
        if (cols.length < 6) continue;
        // | Titre | Genre | Statut | Note | MC | Durée | Notes |
        game = {
          id: uid(toSlug(`${currentConsole}-${cols[0]}`)),
          titre: cols[0],
          console: currentConsole,
          pcGenre: null,
          annee: null,
          genre: cols[1],
          statut: parseStatus(cols[2]),
          note: parseFloat(cols[3]) || null,
          metacritic: parseMC(cols[4]),
          duree: cols[5] || '',
          notes: cols[6] || '',
        };
      }

      games.push(game);
    }
  }

  return games;
}

// ─── Data Layer ───────────────────────────────────────────────────────────────

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadGames() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}

function initData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    console.log('📋 Importing backlog.md → data/games.json …');
    const md = fs.readFileSync(MARKDOWN_FILE, 'utf8');
    const games = parseMarkdown(md);
    saveGames(games);
    console.log(`✅ ${games.length} jeux importés.`);
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

app.get('/api/games', (req, res) => {
  try {
    let games = loadGames();
    const { console: con, statut, search } = req.query;

    if (con)    games = games.filter(g => g.console === con);
    if (statut) games = games.filter(g => g.statut === statut);
    if (search) {
      const q = search.toLowerCase();
      games = games.filter(g => g.titre.toLowerCase().includes(q));
    }

    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games/:id', (req, res) => {
  try {
    const games = loadGames();
    const game = games.find(g => g.id === req.params.id);
    if (!game) return res.status(404).json({ error: 'Not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id', (req, res) => {
  try {
    const games = loadGames();
    const idx = games.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { statut, note, notes } = req.body;
    if (statut !== undefined) games[idx].statut = statut;
    if (note !== undefined) games[idx].note = note;
    if (notes !== undefined) games[idx].notes = notes;

    saveGames(games);
    res.json(games[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games', (req, res) => {
  try {
    const games = loadGames();
    const { titre, console: con, genre, statut, note, metacritic, duree, notes } = req.body;

    if (!titre || !con) return res.status(400).json({ error: 'titre et console sont requis' });

    const base = toSlug(`${con}-${titre}`);
    let id = base;
    let n  = 2;
    while (games.find(g => g.id === id)) id = `${base}-${n++}`;

    const game = {
      id,
      titre:      titre.trim(),
      console:    con,
      pcGenre:    con === 'PC' ? (genre || null) : null,
      annee:      null,
      genre:      (genre  || '').trim(),
      statut:     statut  || 'todo',
      note:       note       != null ? parseFloat(note)       : null,
      metacritic: metacritic != null ? parseInt(metacritic, 10) || null : null,
      duree:      (duree  || '').trim(),
      notes:      (notes  || '').trim(),
    };

    games.push(game);
    saveGames(games);
    res.status(201).json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const games = loadGames();
    const byConsole = {};

    for (const g of games) {
      if (!byConsole[g.console]) {
        byConsole[g.console] = { total: 0, done: 0, todo: 0, categorie: g.categorie };
      }
      byConsole[g.console].total++;
      if (g.statut === 'done') byConsole[g.console].done++;
      if (g.statut === 'todo') byConsole[g.console].todo++;
    }

    res.json({
      total: games.length,
      todo: games.filter(g => g.statut === 'todo').length,
      done: games.filter(g => g.statut === 'done').length,
      replay: games.filter(g => g.statut === 'replay').length,
      paused: games.filter(g => g.statut === 'paused').length,
      dropped: games.filter(g => g.statut === 'dropped').length,
      byConsole,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

initData();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮  Backlog → http://localhost:${PORT}`);
});
