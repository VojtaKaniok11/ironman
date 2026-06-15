// ====== Frontend logika Iron-Man trackeru ======

const RACE_GOALS = {
  swim: { km: 15, label: 'PLAVÁNÍ', ico: '🏊', cls: 'swim' },
  bike: { km: 1000, label: 'KOLO', ico: '🚴', cls: 'bike' },
  run: { km: 350, label: 'BĚH', ico: '🏃', cls: 'run' },
};

const $ = (sel) => document.querySelector(sel);
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const preview = $('#preview');
const previewImg = $('#previewImg');
const analyzeBtn = $('#analyzeBtn');
const saveBtn = $('#saveBtn');
const statusEl = $('#status');
const resultsEl = $('#results');

let currentFile = null;
let currentTab = 'all';

// ---------- Pomocné formátovače ----------
function fmtTime(sec) {
  if (!sec && sec !== 0) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtKm(km) {
  if (km === null || km === undefined) return '–';
  return `${Number(km).toFixed(2)} km`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function setStatus(msg, type = '', loading = false) {
  statusEl.className = 'status ' + type + (loading ? ' loader' : '');
  statusEl.textContent = msg;
}

// ---------- Nahrání souboru ----------
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]));

['dragover', 'dragenter'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});
// Vložení screenshotu přes Ctrl+V
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

function loadFile(file) {
  if (!file.type.startsWith('image/')) { setStatus('To není obrázek.', 'err'); return; }
  currentFile = file;
  previewImg.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
  analyzeBtn.classList.remove('hidden');
  resultsEl.innerHTML = '';
  saveBtn.classList.add('hidden');
  setStatus('Screenshot připraven. Klikni na „NAČÍST POMOCÍ AI".');
}

// ---------- AI analýza ----------
analyzeBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  analyzeBtn.disabled = true;
  setStatus('AI čte tvůj screenshot', '', true);
  resultsEl.innerHTML = '';
  saveBtn.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('screenshot', currentFile);
    const res = await fetch('/api/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba serveru');

    renderResultCards(data.activities);
    setStatus(`Hotovo! Našel jsem ${data.activities.length} trénink(y). Zkontroluj a ulož.`, 'ok');
    saveBtn.classList.remove('hidden');
  } catch (err) {
    setStatus('Chyba: ' + err.message, 'err');
  } finally {
    analyzeBtn.disabled = false;
  }
});

// ---------- Editovatelné karty z AI ----------
function renderResultCards(activities) {
  resultsEl.innerHTML = '';
  const today = new Date().toISOString().slice(0, 10);

  activities.forEach((a, idx) => {
    const card = document.createElement('div');
    card.className = 'rcard';
    card.dataset.idx = idx;
    card.innerHTML = `
      <h3>TRÉNINK #${idx + 1}</h3>
      <div class="rgrid">
        ${field('discipline', 'Disciplína', a.discipline, 'select')}
        ${field('date', 'Datum', a.date || today, 'date')}
        ${field('title', 'Název', a.title, 'text', 'full')}
        ${field('distance_km', 'Vzdálenost (km)', a.distance_km, 'number')}
        ${field('duration_text', 'Čas', a.duration_text, 'text')}
        ${field('pace', 'Tempo', a.pace, 'text')}
        ${field('avg_speed_kmh', 'Rychlost (km/h)', a.avg_speed_kmh, 'number')}
        ${field('avg_hr', 'Tep (prům.)', a.avg_hr, 'number')}
        ${field('calories', 'Kalorie', a.calories, 'number')}
        ${field('elevation_m', 'Převýšení (m)', a.elevation_m, 'number')}
        ${field('notes', 'Poznámka', a.notes, 'text', 'full')}
      </div>`;
    // skrytá data pro duration_sec
    card.dataset.durationSec = a.duration_sec ?? '';
    resultsEl.appendChild(card);
  });
}

function field(name, label, value, type = 'text', extra = '') {
  const v = value ?? '';
  if (type === 'select') {
    return `<div class="field ${extra}"><label>${label}</label>
      <select name="${name}">
        <option value="swim" ${v === 'swim' ? 'selected' : ''}>🏊 Plavání</option>
        <option value="bike" ${v === 'bike' ? 'selected' : ''}>🚴 Kolo</option>
        <option value="run" ${v === 'run' ? 'selected' : ''}>🏃 Běh</option>
      </select></div>`;
  }
  const step = type === 'number' ? 'step="any"' : '';
  return `<div class="field ${extra}"><label>${label}</label>
    <input type="${type}" name="${name}" value="${esc(v)}" ${step} /></div>`;
}

// ---------- Uložení ----------
saveBtn.addEventListener('click', async () => {
  const cards = [...resultsEl.querySelectorAll('.rcard')];
  if (cards.length === 0) return;

  const items = cards.map((card) => {
    const get = (n) => card.querySelector(`[name="${n}"]`)?.value || null;
    const numOrNull = (n) => { const v = get(n); return v === null || v === '' ? null : Number(v); };
    const durTxt = get('duration_text');
    return {
      discipline: get('discipline'),
      date: get('date'),
      title: get('title'),
      distance_km: numOrNull('distance_km'),
      duration_text: durTxt,
      duration_sec: card.dataset.durationSec ? Number(card.dataset.durationSec) : parseDuration(durTxt),
      pace: get('pace'),
      avg_speed_kmh: numOrNull('avg_speed_kmh'),
      avg_hr: numOrNull('avg_hr'),
      calories: numOrNull('calories'),
      elevation_m: numOrNull('elevation_m'),
      notes: get('notes'),
    };
  });

  saveBtn.disabled = true;
  setStatus('Ukládám do deníku', '', true);
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
    if (!res.ok) throw new Error('Uložení selhalo');
    setStatus('✔ Uloženo! Skvělá práce, hrdino.', 'ok');
    resetUpload();
    await refresh();
  } catch (err) {
    setStatus('Chyba: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
  }
});

function parseDuration(txt) {
  if (!txt) return null;
  const parts = String(txt).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function resetUpload() {
  currentFile = null;
  fileInput.value = '';
  preview.classList.add('hidden');
  analyzeBtn.classList.add('hidden');
  saveBtn.classList.add('hidden');
  resultsEl.innerHTML = '';
}

// ---------- Taby ----------
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    currentTab = t.dataset.d;
    renderLog();
  })
);

// ---------- Načítání + vykreslování dat ----------
let allSessions = [];

async function refresh() {
  const res = await fetch('/api/sessions');
  const data = await res.json();
  allSessions = data.sessions || [];
  renderDashboard();
  renderLog();
}

function renderDashboard() {
  const dash = $('#dashboard');
  dash.innerHTML = '';
  for (const key of ['swim', 'bike', 'run']) {
    const g = RACE_GOALS[key];
    const list = allSessions.filter((s) => s.discipline === key);
    const count = list.length;
    const totalKm = list.reduce((a, s) => a + (s.distance_km || 0), 0);
    const totalSec = list.reduce((a, s) => a + (s.duration_sec || 0), 0);
    const pct = Math.min(100, Math.round((totalKm / g.km) * 100));

    const card = document.createElement('div');
    card.className = `stat-card ${g.cls}`;
    card.innerHTML = `
      <div class="stat-head"><span>${g.ico} ${g.label}</span><span>${g.km} km</span></div>
      <div class="stat-row"><span>Tréninků</span><span>${count}</span></div>
      <div class="stat-row"><span>Celkem km</span><span>${totalKm.toFixed(1)}</span></div>
      <div class="stat-row"><span>Celkem čas</span><span>${fmtTime(totalSec)}</span></div>
      <div class="bar-label">Progres k cíli (celkem / cíl)</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="bar-pct">${totalKm.toFixed(1)} / ${g.km} km · ${pct}%</div>`;
    dash.appendChild(card);
  }
}

function renderLog() {
  const log = $('#log');
  const list = currentTab === 'all'
    ? allSessions
    : allSessions.filter((s) => s.discipline === currentTab);

  if (list.length === 0) {
    log.innerHTML = `<div class="empty">Zatím žádné tréninky. Nahraj první screenshot! 🎮</div>`;
    return;
  }

  log.innerHTML = list.map((s) => {
    const g = RACE_GOALS[s.discipline] || { ico: '🎯' };
    const nums = [
      s.distance_km != null ? `<b>${fmtKm(s.distance_km)}</b>` : '',
      s.duration_sec != null ? fmtTime(s.duration_sec) : (s.duration_text || ''),
      s.pace ? `@ ${esc(s.pace)}` : '',
      s.avg_hr ? `♥ ${s.avg_hr}` : '',
      s.avg_speed_kmh ? `${s.avg_speed_kmh} km/h` : '',
    ].filter(Boolean).join(' · ');

    return `
      <div class="entry ${s.discipline}">
        <div class="ico">${g.ico}</div>
        <div class="meta">
          <div class="ttl">${esc(s.title || g.label || '')}</div>
          <div class="sub">${esc(s.date)}${s.notes ? ' · ' + esc(s.notes) : ''}</div>
          <div class="nums">${nums}</div>
        </div>
        <button class="del" data-id="${s.id}">✕</button>
      </div>`;
  }).join('');

  log.querySelectorAll('.del').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Smazat tento trénink?')) return;
      await fetch('/api/sessions/' + btn.dataset.id, { method: 'DELETE' });
      await refresh();
    })
  );
}

// Start
refresh();
