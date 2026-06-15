// Databázová vrstva - Turso (libSQL) přes HTTP klienta.
// "/web" varianta nemá nativní binárky, takže běží bez problémů
// jak lokálně, tak v serverless prostředí (Vercel).
import { createClient } from '@libsql/client/web';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    'Chybí TURSO_DATABASE_URL nebo TURSO_AUTH_TOKEN. Vlož je do souboru .env (viz .env.example).'
  );
}

const db = createClient({ url, authToken });

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,            -- YYYY-MM-DD
      discipline    TEXT    NOT NULL,            -- 'swim' | 'bike' | 'run'
      title         TEXT,                        -- název tréninku
      distance_km   REAL,                        -- vzdálenost v km (plavání převedeno na km)
      duration_sec  INTEGER,                     -- doba trvání v sekundách
      duration_text TEXT,                        -- původní zápis času, např. "1:23:45"
      pace          TEXT,                        -- tempo, např. "5:30 /km" nebo "1:45 /100m"
      avg_speed_kmh REAL,                        -- průměrná rychlost (hlavně kolo)
      avg_hr        INTEGER,                     -- průměrná tepová frekvence
      calories      INTEGER,
      elevation_m   REAL,                        -- převýšení
      notes         TEXT,
      raw_json      TEXT,                        -- kompletní data z AI (pro jistotu)
      created_at    TEXT    NOT NULL
    );
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sessions_discipline ON sessions(discipline);');
}

export async function insertSession(s) {
  const result = await db.execute({
    sql: `INSERT INTO sessions
            (date, discipline, title, distance_km, duration_sec, duration_text,
             pace, avg_speed_kmh, avg_hr, calories, elevation_m, notes, raw_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      s.date,
      s.discipline,
      s.title ?? null,
      s.distance_km ?? null,
      s.duration_sec ?? null,
      s.duration_text ?? null,
      s.pace ?? null,
      s.avg_speed_kmh ?? null,
      s.avg_hr ?? null,
      s.calories ?? null,
      s.elevation_m ?? null,
      s.notes ?? null,
      s.raw_json ?? null,
      new Date().toISOString(),
    ],
  });
  return getSession(Number(result.lastInsertRowid));
}

export async function getSession(id) {
  const result = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [id] });
  return result.rows[0] ?? null;
}

export async function listSessions({ discipline } = {}) {
  if (discipline && discipline !== 'all') {
    const result = await db.execute({
      sql: 'SELECT * FROM sessions WHERE discipline = ? ORDER BY date DESC, id DESC',
      args: [discipline],
    });
    return result.rows;
  }
  const result = await db.execute('SELECT * FROM sessions ORDER BY date DESC, id DESC');
  return result.rows;
}

export async function deleteSession(id) {
  return db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [id] });
}

// Souhrnné statistiky pro každou disciplínu (počet tréninků, km, čas).
export async function getStats() {
  const result = await db.execute(`
    SELECT discipline,
           COUNT(*)                        AS count,
           COALESCE(SUM(distance_km), 0)   AS total_km,
           COALESCE(SUM(duration_sec), 0)  AS total_sec
    FROM sessions
    GROUP BY discipline
  `);

  const stats = {
    swim: { count: 0, total_km: 0, total_sec: 0 },
    bike: { count: 0, total_km: 0, total_sec: 0 },
    run: { count: 0, total_km: 0, total_sec: 0 },
  };
  for (const r of result.rows) {
    if (stats[r.discipline]) {
      stats[r.discipline] = {
        count: Number(r.count),
        total_km: Number(r.total_km),
        total_sec: Number(r.total_sec),
      };
    }
  }
  return stats;
}

export default db;
