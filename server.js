import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { extractFromImage } from './ai.js';
import {
  initDb,
  insertSession,
  listSessions,
  deleteSession,
  getStats,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(join(__dirname, 'public')));

const dbReady = initDb();

// Na serverless cold startu zajistí, že je DB inicializovaná před prvním requestem.
app.use((req, res, next) => {
  dbReady.then(() => next(), next);
});

// Obrázky držíme v paměti (nic se neukládá na disk navíc), limit 15 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Cíle závodu Half Iron-Man.
const RACE_GOALS = {
  swim: { distance_km: 1.9, label: 'Plavání' },
  bike: { distance_km: 90, label: 'Kolo' },
  run: { distance_km: 21.1, label: 'Běh' },
};

// --- Analýza screenshotu přes AI (zatím se NEUKLÁDÁ, jen vrátí data) ---
app.post('/api/analyze', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nebyl nahrán žádný obrázek.' });
    }
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const activities = await extractFromImage(dataUrl);
    if (activities.length === 0) {
      return res
        .status(422)
        .json({ error: 'Na obrázku se nepodařilo najít žádný trénink.' });
    }
    res.json({ activities });
  } catch (err) {
    console.error('Chyba při analýze:', err);
    res.status(500).json({ error: err.message || 'Chyba při čtení obrázku.' });
  }
});

// --- Uložení (potvrzených) tréninků do databáze ---
app.post('/api/sessions', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const saved = [];
    for (const item of items) {
      if (!item || !item.discipline) continue;
      const s = {
        ...item,
        date: item.date || new Date().toISOString().slice(0, 10),
        raw_json: JSON.stringify(item),
      };
      saved.push(await insertSession(s));
    }
    res.json({ saved });
  } catch (err) {
    console.error('Chyba při ukládání:', err);
    res.status(500).json({ error: 'Trénink se nepodařilo uložit.' });
  }
});

// --- Výpis tréninků (volitelně filtr podle disciplíny) ---
app.get('/api/sessions', async (req, res) => {
  const { discipline } = req.query;
  res.json({ sessions: await listSessions({ discipline }) });
});

// --- Smazání tréninku ---
app.delete('/api/sessions/:id', async (req, res) => {
  await deleteSession(Number(req.params.id));
  res.json({ ok: true });
});

// --- Statistiky + cíle závodu ---
app.get('/api/stats', async (req, res) => {
  res.json({ stats: await getStats(), goals: RACE_GOALS });
});

// Na Vercelu (serverless) se app jen exportuje, listen() se nevolá.
if (!process.env.VERCEL) {
  dbReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n  IRON-MAN TRACKER bezi na  http://localhost:${PORT}\n`);
        if (!process.env.OPENAI_API_KEY) {
          console.log('  Pozor: chybi OPENAI_API_KEY v souboru .env -- cteni screenshotu nebude fungovat.\n');
        }
      });
    })
    .catch((err) => {
      console.error('Nepodařilo se inicializovat databázi:', err);
      process.exit(1);
    });
}

export default app;
