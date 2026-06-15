# 🏊 🚴 🏃 HALF IRON-MAN TRACKER

Retro (8-bit / „stará videohra") tréninkový deník pro přípravu na závod **Half Iron-Man**
(1.9 km plavání · 90 km kolo · 21.1 km běh).

Nahraješ screenshot z hodinek / Stravy / Garminu, **AI (OpenAI `gpt-4o-mini`)** z něj
přečte všechna data o tréninku, ty je zkontroluješ a uložíš do databáze.
Vše je rozdělené do tří sekcí: **plavání / kolo / běh**. Funguje na počítači i mobilu.

---

## ⚡ Rychlý start

### 1. Nainstaluj závislosti
V této složce spusť:
```
npm install
```
(Už je hotovo, pokud jsi tento krok dělal se mnou.)

### 2. Vlož přístupové údaje
- Zkopíruj soubor `.env.example` a přejmenuj kopii na `.env`
- Otevři `.env` a vyplň:
```
OPENAI_API_KEY=sk-tvuj-klic
TURSO_DATABASE_URL=libsql://tvoje-db.turso.io
TURSO_AUTH_TOKEN=tvuj-token
```
OpenAI klíč získáš na <https://platform.openai.com/api-keys>.
Turso údaje získáš v dashboardu na <https://turso.tech> (vytvoř databázi → Create Token).

> 💸 **Cena:** používá se nejlevnější „vision" model `gpt-4o-mini`.
> Jeden screenshot stojí přibližně **$0.0002–0.0003**, takže s 4 USD přečteš
> klidně **10 000+ screenshotů**. Turso je v free tieru zdarma pro osobní použití.

### 3. Spusť aplikaci
```
npm start
```
Pak otevři v prohlížeči: <http://localhost:3000>

---

## 🎮 Jak se to používá

1. **Nahraj screenshot** – přetáhni ho do okénka, klikni a vyber soubor,
   nebo ho jen vlož přes **Ctrl + V**.
2. Klikni na **⚡ NAČÍST POMOCÍ AI** – AI přečte disciplínu, vzdálenost,
   čas, tempo, tep, kalorie, převýšení atd.
3. **Zkontroluj / oprav** vyplněná políčka (AI se občas splete).
4. Klikni **💾 ULOŽIT DO DENÍKU**.
5. Dole v **deníku** filtruješ podle disciplíny a sleduješ statistiky
   a „připravenost" (nejdelší trénink vs. cíl závodu).

---

## 🗂️ Struktura projektu

| Soubor / složka | K čemu slouží |
|---|---|
| `server.js`        | Express server + API routy |
| `ai.js`            | Čtení screenshotu přes OpenAI vision |
| `db.js`            | Databáze (Turso / libSQL přes HTTP) |
| `public/`          | Frontend (HTML / CSS / JS, retro styl) |
| `api/index.js`     | Vstupní bod pro Vercel serverless funkci |
| `vercel.json`      | Konfigurace nasazení na Vercel |
| `.env`             | OpenAI klíč + Turso přístupové údaje (necommituje se) |

### Kde jsou moje data?
V cloudové **Turso** databázi (SQLite kompatibilní, libSQL) — stejná databáze
se používá lokálně i na Vercelu, takže appka vidí stejná data odkudkoliv.
Free tier je víc než dost pro osobní použití. Nic dalšího se nikam neposílá,
kromě samotného screenshotu do OpenAI při čtení.

---

## 🚀 Nasazení na Vercel (přístup z mobilu odkudkoliv)

1. V nastavení projektu na [vercel.com](https://vercel.com) → **Settings → Environment Variables**
   doplň (Production):
   - `OPENAI_API_KEY` – tvůj OpenAI klíč
   - `TURSO_DATABASE_URL` – z Turso dashboardu
   - `TURSO_AUTH_TOKEN` – z Turso dashboardu
2. Spusť `vercel --prod` (nebo redeploy z webu) — appka poběží na
   `https://tvuj-projekt.vercel.app`, otevřeš ji z mobilu odkudkoliv.

---

## 🔧 Technologie
- **Node.js** + **Turso/libSQL** (`@libsql/client/web` — bez nativních závislostí)
- **Express** + **Multer** (nahrávání obrázku)
- **OpenAI** `gpt-4o-mini` (vision)
- Čistý HTML/CSS/JS frontend, bez build kroku
- **Vercel** (serverless nasazení, `api/index.js` + `vercel.json`)

> Vyžaduje Node.js **22.5+** (ty máš v24 ✅).
