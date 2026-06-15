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

### 2. Vlož svůj OpenAI API klíč
- Zkopíruj soubor `.env.example` a přejmenuj kopii na `.env`
- Otevři `.env` a vlož svůj klíč:
```
OPENAI_API_KEY=sk-tvuj-klic
```
Klíč získáš na <https://platform.openai.com/api-keys>.

> 💸 **Cena:** používá se nejlevnější „vision" model `gpt-4o-mini`.
> Jeden screenshot stojí přibližně **$0.0002–0.0003**, takže s 4 USD přečteš
> klidně **10 000+ screenshotů**. Rozpočet je v pohodě.

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
| `db.js`            | Databáze (libSQL – lokální soubor nebo Turso) |
| `public/`          | Frontend (HTML / CSS / JS, retro styl) |
| `data/training.db` | Tvoje data – lokální databáze (vznikne po prvním uložení) |
| `api/index.js`     | Vstupní bod pro Vercel serverless funkci |
| `vercel.json`      | Konfigurace nasazení na Vercel |
| `.env`             | Tvůj OpenAI klíč + (volitelně) Turso přístupové údaje |

### Kde jsou moje data?
Databáze je přes **libSQL** (SQLite kompatibilní).
- **Lokálně** (`npm start`) se data ukládají do souboru `data/training.db` na tvém
  počítači — nic se nikam neposílá kromě samotného screenshotu do OpenAI při čtení.
- **Na Vercelu** (viz níže) se použije vzdálená **Turso** databáze, protože Vercel
  neumí trvale ukládat soubory na disk.

---

## 🚀 Nasazení na Vercel (přístup z mobilu odkudkoliv)

Aby appka šla nasadit na Vercel, potřebuje databázi mimo lokální disk —
k tomu slouží **Turso** (cloud SQLite, zdarma pro osobní použití).

### 1. Vytvoř Turso databázi
1. Zaregistruj se na <https://turso.tech> (zdarma).
2. Nainstaluj Turso CLI a přihlas se (nebo použij web dashboard):
   ```
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. Vytvoř databázi a zjisti přihlašovací údaje:
   ```
   turso db create ironman-tracker
   turso db show ironman-tracker --url
   turso db tokens create ironman-tracker
   ```
   První příkaz vypíše `TURSO_DATABASE_URL` (začíná `libsql://...`),
   druhý vypíše `TURSO_AUTH_TOKEN`.

### 2. Nasaď na Vercel
1. Nainstaluj Vercel CLI: `npm install -g vercel`
2. V této složce spusť: `vercel`
   (přihlásíš se přes browser, projekt se vytvoří)
3. V nastavení projektu na [vercel.com](https://vercel.com) → **Settings → Environment Variables**
   doplň:
   - `OPENAI_API_KEY` – tvůj OpenAI klíč
   - `TURSO_DATABASE_URL` – z kroku 1
   - `TURSO_AUTH_TOKEN` – z kroku 1
4. Spusť `vercel --prod` (nebo redeploy z webu) — appka poběží na
   `https://tvuj-projekt.vercel.app`, otevřeš ji z mobilu odkudkoliv.

> 💡 Lokální vývoj (`npm start`) dál funguje normálně bez Turso účtu —
> `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` se použijí jen pokud jsou v `.env` vyplněné.

---

## 🔧 Technologie
- **Node.js** + **libSQL** (`@libsql/client`) — lokálně soubor, na Vercelu Turso
- **Express** + **Multer** (nahrávání obrázku)
- **OpenAI** `gpt-4o-mini` (vision)
- Čistý HTML/CSS/JS frontend, bez build kroku
- **Vercel** (serverless nasazení, `api/index.js` + `vercel.json`)

> Vyžaduje Node.js **22.5+** (ty máš v24 ✅).
