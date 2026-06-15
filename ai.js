// AI modul - přečte screenshot tréninku přes OpenAI vision (gpt-4o-mini).
// Vrací strukturovaná data, která se pak zobrazí uživateli k potvrzení.
import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'Chybí OPENAI_API_KEY. Zkopíruj .env.example do .env a vlož svůj OpenAI klíč.'
    );
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `Jsi pomocník, který ze screenshotů fitness/sportovních aplikací (Garmin, Strava, Apple Watch, apod.)
vyčítá data o tréninku pro triatlonistu, který trénuje na závod Half Iron-Man.

Z obrázku vytěž VŠECHNY tréninky, které na něm jsou. Pro každý vrať objekt s těmito poli:
- discipline: jedna z hodnot "swim" (plavání), "bike" (kolo) nebo "run" (běh). Urči podle ikony, názvu nebo metrik.
- title: krátký název tréninku, jak je na obrázku (nebo null).
- date: datum ve formátu "YYYY-MM-DD", pokud je čitelné, jinak null.
- distance_km: vzdálenost VŽDY v kilometrech jako číslo. Pokud je plavání v metrech, převeď na km (např. 1900 m = 1.9).
- duration_text: doba trvání tak, jak je napsaná (např. "1:23:45" nebo "45:10"), jinak null.
- duration_seconds: doba trvání převedená na celkový počet sekund jako číslo, jinak null.
- pace: tempo přesně jak je uvedeno (např. "5:30 /km", "1:45 /100m"), jinak null.
- avg_speed_kmh: průměrná rychlost v km/h jako číslo (hlavně u kola), jinak null.
- avg_hr: průměrná tepová frekvence jako celé číslo, jinak null.
- calories: spálené kalorie jako celé číslo, jinak null.
- elevation_m: převýšení v metrech jako číslo, jinak null.
- notes: cokoli dalšího zajímavého (počasí, pocit, poznámka), jinak null.

Pravidla:
- Vracej POUZE data, která na obrázku skutečně vidíš. Co nevidíš, dej null. Nic si nevymýšlej.
- Čísla vracej jako čísla (ne řetězce), bez jednotek.
- Odpověz výhradně validním JSON objektem ve tvaru: {"activities": [ ... ]}.`;

export async function extractFromImage(dataUrl) {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Vytěž data o tréninku/trénincích z tohoto screenshotu.',
          },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI nevrátila platný JSON. Zkus to prosím znovu.');
  }

  const activities = Array.isArray(parsed.activities) ? parsed.activities : [];
  return activities.map(normalize);
}

// Sjednotí a očistí jeden záznam z AI do podoby pro databázi.
function normalize(a) {
  const disciplineMap = {
    swim: 'swim', plavani: 'swim', plavání: 'swim', swimming: 'swim',
    bike: 'bike', kolo: 'bike', cycling: 'bike', ride: 'bike',
    run: 'run', beh: 'run', běh: 'run', running: 'run',
  };
  const d = String(a.discipline || '').toLowerCase().trim();
  const discipline = disciplineMap[d] || 'run';

  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const int = (v) => (num(v) === null ? null : Math.round(num(v)));

  return {
    discipline,
    title: a.title ?? null,
    date: a.date ?? null,
    distance_km: num(a.distance_km),
    duration_text: a.duration_text ?? null,
    duration_sec: int(a.duration_seconds),
    pace: a.pace ?? null,
    avg_speed_kmh: num(a.avg_speed_kmh),
    avg_hr: int(a.avg_hr),
    calories: int(a.calories),
    elevation_m: num(a.elevation_m),
    notes: a.notes ?? null,
  };
}
