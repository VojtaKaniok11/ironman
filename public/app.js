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

// ---------- Datum (bez roku) ----------
const pad2 = (n) => String(n).padStart(2, '0');

// Dnešní datum jako "DD.MM." (bez roku).
function todayDM() {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

// Z uloženého data "YYYY-MM-DD" udělá pro zobrazení "DD.MM." (rok schová).
function fmtDateDM(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.`;
  return esc(iso || '–');
}

// Z uživatelského vstupu "DD.MM." (nebo "DD.MM.RRRR") udělá pro uložení
// "YYYY-MM-DD". Když rok není zadaný, doplní aktuální rok automaticky.
function parseDateInput(str) {
  const now = new Date();
  const s = String(str ?? '').trim();
  if (s) {
    let m = s.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s*[.\/-]\s*(\d{2,4}))?\.?$/);
    if (m) {
      const day = +m[1], mon = +m[2];
      let yr = m[3] ? +m[3] : now.getFullYear();
      if (yr < 100) yr += 2000;
      if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
        return `${yr}-${pad2(mon)}-${pad2(day)}`;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // už ISO
  }
  return now.toISOString().slice(0, 10);
}

// ---------- České názvy měsíců + klíče ----------
const MONTHS_CS = ['LEDEN', 'ÚNOR', 'BŘEZEN', 'DUBEN', 'KVĚTEN', 'ČERVEN',
  'ČERVENEC', 'SRPEN', 'ZÁŘÍ', 'ŘÍJEN', 'LISTOPAD', 'PROSINEC'];

function monthKeyOf(iso) {
  return String(iso ?? '').slice(0, 7); // "YYYY-MM"
}
function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS_CS[m - 1] || key;
  const curY = new Date().getFullYear();
  return y === curY ? name : `${name} <span class="yr">${y}</span>`;
}
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

// ---------- Tempo / rychlost ----------
function fmtClock(sec) { // celé sekundy -> "M:SS"
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${pad2(s)}`;
}
function fmtPerf(disc, st) {
  // Vrátí výkonnostní metriku měsíce pro danou disciplínu.
  if (!st.km || !st.sec) return null;
  if (disc === 'bike') {
    return { value: (st.km * 3600) / st.sec, text: `${((st.km * 3600) / st.sec).toFixed(1)} km/h`, higherBetter: true };
  }
  if (disc === 'swim') {
    const sp = st.sec / (st.km * 10); // sekund / 100 m
    return { value: sp, text: `${fmtClock(sp)} /100m`, higherBetter: false };
  }
  const sp = st.sec / st.km; // běh: sekund / km
  return { value: sp, text: `${fmtClock(sp)} /km`, higherBetter: false };
}

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
  const today = todayDM();

  activities.forEach((a, idx) => {
    const card = document.createElement('div');
    card.className = 'rcard';
    card.dataset.idx = idx;
    card.innerHTML = `
      <h3>TRÉNINK #${idx + 1}</h3>
      <div class="rgrid">
        ${field('discipline', 'Disciplína', a.discipline, 'select')}
        ${field('date', 'Datum (DD.MM. — rok nech prázdný)', a.date || today, 'text')}
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
      date: parseDateInput(get('date')),
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

  // Rozdělení záznamů podle měsíce ("YYYY-MM"), nejnovější nahoře.
  const byMonth = new Map();
  for (const s of list) {
    const key = monthKeyOf(s.date);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(s);
  }
  const monthKeys = [...byMonth.keys()].sort().reverse();
  const disciplines = currentTab === 'all' ? ['swim', 'bike', 'run'] : [currentTab];

  log.innerHTML = monthKeys.map((key) => {
    const entries = byMonth.get(key).map(entryHtml).join('');
    return `
      <div class="month-group">
        <div class="month-header">» ${monthLabel(key)} «</div>
        ${monthComparisonHtml(key, disciplines)}
        <div class="month-entries">${entries}</div>
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

// Jeden řádek deníku.
function entryHtml(s) {
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
        <div class="sub">${fmtDateDM(s.date)}${s.notes ? ' · ' + esc(s.notes) : ''}</div>
        <div class="nums">${nums}</div>
      </div>
      <button class="del" data-id="${s.id}">✕</button>
    </div>`;
}

// Souhrn měsíce pro jednu disciplínu.
function monthStats(monthKey, disc) {
  const list = allSessions.filter(
    (s) => s.discipline === disc && monthKeyOf(s.date) === monthKey
  );
  return {
    count: list.length,
    km: list.reduce((a, s) => a + (s.distance_km || 0), 0),
    sec: list.reduce((a, s) => a + (s.duration_sec || 0), 0),
  };
}

// Štítek s rozdílem proti minulému měsíci (▲ zelená = zlepšení).
function deltaTag(cur, prev, higherBetter, fmtDiff) {
  if (prev === null || prev === undefined) return `<i class="neu">—</i>`;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return `<i class="neu">beze změny</i>`;
  const better = higherBetter ? d > 0 : d < 0;
  return `<i class="${better ? 'up' : 'down'}">${better ? '▲' : '▼'} ${fmtDiff(d, better)}</i>`;
}

// Porovnávací karty pro daný měsíc vs. předchozí měsíc, po disciplínách.
function monthComparisonHtml(monthKey, disciplines) {
  const prevKey = prevMonthKey(monthKey);
  const isCurrent = monthKey === currentMonthKey();

  const cards = disciplines.map((disc) => {
    const cur = monthStats(monthKey, disc);
    if (cur.count === 0) return ''; // tuto disciplínu jsem tento měsíc netrénoval
    const prev = monthStats(prevKey, disc);
    const havePrev = prev.count > 0;
    const g = RACE_GOALS[disc];

    const rows = [];
    rows.push(cmpRow('Tréninků', String(cur.count),
      deltaTag(cur.count, havePrev ? prev.count : null, true, (d) => (d > 0 ? '+' : '') + d)));
    rows.push(cmpRow('Vzdálenost', `${cur.km.toFixed(1)} km`,
      deltaTag(cur.km, havePrev ? prev.km : null, true, (d) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} km`)));
    rows.push(cmpRow('Čas', fmtTime(cur.sec),
      deltaTag(cur.sec, havePrev ? prev.sec : null, true, (d) => `${d > 0 ? '+' : '−'}${fmtTime(Math.abs(d))}`)));

    const curPerf = fmtPerf(disc, cur);
    const prevPerf = havePrev ? fmtPerf(disc, prev) : null;
    if (curPerf) {
      const perfLabel = disc === 'bike' ? 'Rychlost' : 'Tempo';
      rows.push(cmpRow(perfLabel, curPerf.text,
        deltaTag(curPerf.value, prevPerf ? prevPerf.value : null, curPerf.higherBetter,
          (d, better) => disc === 'bike'
            ? `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} km/h`
            : `${better ? 'rychlejší' : 'pomalejší'} o ${fmtClock(Math.abs(d))}`)));
    }

    const note = havePrev
      ? `vs. ${MONTHS_CS[(prevKey.split('-')[1] | 0) - 1].toLowerCase()}`
      : 'minulý měsíc bez tréninku — není s čím porovnat';

    return `
      <div class="cmp ${disc}">
        <div class="cmp-head">${g.ico} ${g.label}</div>
        ${rows.join('')}
        <div class="cmp-note">${note}</div>
      </div>`;
  }).filter(Boolean).join('');

  if (!cards) return '';
  const banner = isCurrent
    ? `<div class="cmp-banner">⏳ Tento měsíc ještě běží — průběžné porovnání s minulým měsícem</div>`
    : `<div class="cmp-banner">📊 Měsíční bilance vs. předchozí měsíc</div>`;
  return `<div class="cmp-block">${banner}<div class="cmp-wrap">${cards}</div></div>`;
}

function cmpRow(label, value, tag) {
  return `<div class="cmp-row"><span>${label}</span><b>${value}</b>${tag}</div>`;
}

// Start
refresh();
