# AGENTS.md

Pravila za sve AI agente u ovom repozitorijumu. Zahtjevi i scenariji su u SPEC.md.

## Projekat
Expense Splitter: web aplikacija za dijeljenje troškova u grupi. Korisnik se prijavi, pravi grupe, dodaje učesnike i troškove, a aplikacija pokazuje ko kome duguje.

## Funkcionalnost

### Prijava (jedan nalog)
- Nema registracije. Jedan nalog, čiji su username i lozinka u env varijablama `APP_USERNAME` i `APP_PASSWORD`.
- Forma sa dva polja i dugme "Prijavi se". Odjava dugme u headeru.
- Poređenje preko `crypto.timingSafeEqual`. Poruka greške uvijek: "Pogrešno korisničko ime ili lozinka".
- Sesija u `express-session`, kolačić `httpOnly`.
- Svi API endpointi osim `/api/login` traže prijavljenu sesiju (`requireAuth`). Bez prijave: 401, frontend preusmjeri na login.
- Nema uloga, registracije, reset lozinke, OAuth ni "zapamti me".

### Grupe
- Sve grupe pripadaju jedinom korisniku (nema vlasništva, nema dijeljenja).
- Korisnik pravi grupu (naziv obavezan, max 40 znakova).
- Grupa ima listu učesnika. Učesnik je ime (tekst), ne nalog. Ime je obavezno, jedinstveno u grupi (poređenje bez obzira na velika/mala slova, trim razmaka).
- Učesnike je moguće dodati u bilo kojem trenutku. Brisanje učesnika nije u opsegu.

### Troškovi
- Polja: naziv (obavezan, max 60 znakova), iznos (obavezan, > 0), ko je platio (jedan učesnik iz grupe).
- Trošak se dijeli jednako na izabrane učesnike (`participants`, default svi učesnici). Bar jedan učesnik je obavezan.
- Trošak se može obrisati (DELETE). Izmjena troška nije u opsegu.
- Dug se može označiti kao isplaćen: zapis plaćanja (`payments`) se uračunava u bilans, pa dug nestaje iz liste. Plaćanje se može poništiti (DELETE).
- Iznos se unosi kao `90,00` ili `90.00` (oba zareza i tačke su ok). Više od 2 decimale = greška.
- Prazan naziv, nepostojeći platilac ili iznos ≤ 0 = greška; trošak se ne čuva.
- Troškovi se ne mijenjaju (izmjena nije u opsegu). Brisanje je dozvoljeno.

### Obračun
- Logika je u `server/settlement.js` i radi isključivo sa cijelim brojevima u centima.
- Svakom učesniku: `neto = plaćeno − udio u svim troškovima`. Pozitivan = potražuje, negativan = duguje.
- Dugovanja: pohlepno uparivanje najvećeg dužnika sa najvećim povjeriocem, dok svi neti nisu 0. Redoslijed učesnika je redoslijed unosa (deterministično).
- Zaokruživanje: udio = `floor(iznos / n)`; preostali centi idu prvim učesnicima po redoslijedu unosa, po jedan centa. Zbir udjela mora biti tačno jednak iznosu.
- Primjer: 100,00 € za troje → 33,34 + 33,33 + 33,33.

## Stack i struktura
- Node.js 20+, Express (`server/`), React + Vite (`client/`). Jedan `package.json` u korijenu.
- Baza: `server/data/db.json` (JSON fajl, piše se atomično: tmp fajl pa rename). Folder `server/data/` je u `.gitignore`.
- Testovi: Vitest (`server/**/*.test.js`). API testovi: supertest.
- Struktura:
  - `server/index.js`: Express app, rute
  - `server/auth.js`: provjera kredencijala (timingSafeEqual), `requireAuth` middleware
  - `server/store.js`: čitanje/pisanje db.json (samo grupe i troškovi)
  - `server/money.js`: parsiranje iznosa u cente i formatiranje nazad (`9000` → `90,00 €`)
  - `server/settlement.js`: obračun udjela i dugovanja (čista funkcija, bez I/O)
  - `client/src/`: `App.jsx`, `api.js` (jedini fetch poziv), `pages/Login.jsx`, `pages/Groups.jsx`, `pages/Group.jsx`, `components/`
- Ne uvodimo nove biblioteke bez pitanja. Dozvoljeno: express, express-session, react, react-dom, react-router-dom, vite, @vitejs/plugin-react, vitest, supertest, eslint, @eslint/js, globals, concurrently.

## API (kratko)
- `POST /api/login` · `POST /api/logout` · `GET /api/me`
- `GET /api/groups` · `POST /api/groups`
- `GET /api/groups/:id` (učesnici, troškovi, dugovanja u jednom odgovoru)
- `POST /api/groups/:id/members` · `POST /api/groups/:id/expenses` (body: `title`, `amount`, `payer`, `participants`)
- `DELETE /api/groups/:id/expenses/:expenseId`
- `POST /api/groups/:id/payments` (body: `from`, `to`, `amountCents`) · `DELETE /api/groups/:id/payments/:paymentId`
- Detalj grupe sadrži i `payments`. Dugovanja su u `settlement.transfers`.
- Greške: `{ "error": "poruka na bosanskom" }` uz odgovarajući HTTP status (400, 401, 404, 409 za duplo ime).
- Iznosi u API-ju su uvijek cijeli brojevi u centima (`9000`), nikad float.

## Dizajn (UI)
Cilj: čisto, mirno, bez ukrasa. Aplikacija treba da se razumije za 10 sekundi.
- Jedna kolona, maksimalna širina 720px, centrirano. Mobile-first: bez horizontalnog scrolla na 375px.
- Padding bočno 16px. Razmak između sekcija 24px, unutar kartica 16px.
- Boje kao CSS varijable u `:root`. Paleta: pozadina `#f7f7f8`, kartica `#ffffff`, tekst `#1c1c1e`, sekundarni tekst `#6b6b70`, akcent `#2563eb` (dugme, aktivni link), opasnost `#dc2626` (greška), uspjeh `#16a34a` (potražuje).
- Tamna tema: `@media (prefers-color-scheme: dark)` sa obrnutim tokenima. Bez ručnog prekidača.
- Font: system-ui. Naslov 20px/600, tekst 16px, sitno 13px za pomoćne labele. Ne koristiti custom fontove.
- Radijus 8px, border 1px `#e5e5ea`, bez senki (osim blage na kartici: `0 1px 2px rgba(0,0,0,.04)`).
- Dugmad: puna širina na mobilnom, primarno plava, sekundarno bijela sa borderom. Visina min. 44px (dodir).
- Forme: labela iznad inputa (ne placeholder kao labela). Greška ispod polja, crvenom bojom, konkretnom porukom.
- Iznosi: desno poravnati, brojevi sa `font-variant-numeric: tabular-nums`. Format `90,00 €`.
- Dugovanja: red po redu, `Iva → Ana  40,00 €`. Ako nema dugovanja: "Svi su kvit."
- Ekrani: Login/Registracija (jedan ekran, tab ili link između), lista grupa + forma za novu grupu, detalj grupe (učesnici → forma za trošak → lista troškova → dugovanja). Redoslijed odozgo prema dolje.
- Tekst u UI-ju na bosanskom (latinica). Kod, komentari i commit poruke: engleski za kod, bosanski za poruke korisniku.
- Loading: tekst "Učitavanje…" bez spinnera. Prazno stanje: jedna rečenica i sljedeći korak.

## Komande
- Instalacija: `npm install`
- Dev: `npm run dev` (Express na 3001, Vite na 5173 sa proxy-em `/api`)
- Testovi: `npm test` (Vitest, jednom, bez watch moda)
- Lint: `npm run lint` (ESLint)
- Provjera prije "gotovo": `npm test` i `npm run lint` moraju biti zeleni.

## Pravila
- Svaki scenarij iz SPEC.md ima svoj test. Prvo test, pa implementacija.
- Obračun (`settlement.js`) i parsiranje iznosa (`money.js`) imaju testove za granične slučajeve: 0 učesnika, 1 učesnik, dva trošak sa istim iznosom, iznos sa 3 decimale, zarez i tačka.
- Pokreni `npm test` prije svakog commita.
- Jedna funkcionalnost = jedan commit. Poruka u formatu `feat:`, `fix:`, `test:`, `chore:`, `refactor:`.
- Ne mijenjaj postojeći test da bi prošao. Ako test pada, nađi uzrok u kodu.
- Nove rute uvijek idu iza `requireAuth` middleware-a, osim `/api/login`.
- Validacija je na serveru. Klijentska validacija je samo UX, ne zamjena.
- Sve greške koje nisu očekivane idu u generički 500 odgovor, bez stack trace-a klijentu.
- Nema `console.log` sa podacima korisnika, lozinkama ili kolačićima.

## Sigurnost
- `.env` i sve tajne: nikad ne čitati, nikad ne commitovati. Imamo `.env.example` sa praznim vrijednostima.
- `SESSION_SECRET`, `APP_USERNAME`, `APP_PASSWORD` dolaze iz env varijabli. Ako fali bilo koja, server ne starta.
- Kolačić: `httpOnly`, `sameSite: 'lax'`, `secure` samo u produkciji.
- Lozinka je plain text u `.env` (jedan lokalni nalog, prihvatljivo za radionicu). Nikad u kodu, nikad u commitu.
- Ne dodavati bypass sigurnosnih provjera radi testova.

## Poznati nedostaci (namjerno, za sesiju)
- JSON baza nije za produkciju i nije otporna na paralelne upise. Dovoljno za jednu sesiju.
- `express-session` koristi memory store: restart servera briše sesije.
- Nema rate limitinga na login i lozinka je plain text u env-u. Dodati ako aplikacija izađe iz radionice.

## Ne diraj
- `.env`, `server/data/`, `node_modules/`
- `Claude_Code_Hands_On_Sesija_v2.pdf`
