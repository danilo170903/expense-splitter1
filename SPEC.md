# Expense Splitter: specifikacija

## Zahtjevi
1. Prijava: jedan nalog (iz env varijabli). Neprijavljen korisnik ne vidi ni jednu grupu.
2. Korisnik dodaje učesnike u grupu; ime je obavezno i jedinstveno u grupi (bez obzira na velika/mala slova).
3. Korisnik unosi trošak: naziv, iznos, ko je platio i ko učestvuje (default svi). Trošak se dijeli jednako na izabrane učesnike. Iznosi su u centima. Trošak se može obrisati.
4. Aplikacija prikazuje ko kome duguje, uz zaokruživanje po AGENTS.md. Dug se može označiti kao isplaćen, i ta oznaka se može poništiti.

## Scenariji

### S1 - Prijava
- Ispravni `APP_USERNAME` i `APP_PASSWORD` → `POST /api/login` vraća 200, `GET /api/me` vraća korisnika.
- Pogrešna lozinka → 401, poruka "Pogrešno korisničko ime ili lozinka".
- Bez prijave, `GET /api/groups` → 401.

### S2 - Učesnici
- Grupa "Put", dodaj "Ana", "Marko", "Iva" → lista ima tri imena u tom redoslijedu.
- Dodaj "ana" kad već postoji "Ana" → 409.
- Dodaj prazno ime ili "   " → 400, učesnik se ne dodaje.

### S3 - Ručak i taksi
- Učesnici: Ana, Marko, Iva
- Ana plaća ručak 90,00 €; Marko plaća taksi 30,00 €
- Rezultat: Iva → Ana 40,00 €; Marko → Ana 10,00 €

### S4 - Zaokruživanje
- Učesnici: Ana, Marko, Iva
- Ana plaća 100,00 € za troje
- Udjeli: 33,34 (Ana) + 33,33 (Marko) + 33,33 (Iva); zbir je tačno 100,00 €
- Višak centa ide prvom učesniku po redoslijedu unosa
- Dugovanja: Marko → Ana 33,33 €; Iva → Ana 33,33 €

### S5 - Neispravan trošak
- Iznos `12,345` → 400 (više od 2 decimale)
- Iznos `0` ili `-5` → 400
- Platilac "Petar" koji nije u grupi → 400
- Prazan naziv troška → 400
- Nijedan od ovih unosa ne ostavlja trošak u grupi.

### S6 - Nema dugovanja
- Učesnik Ana sam u grupi, trošak 50,00 € koji plaća Ana → prikaz "Svi su kvit.", nema dugovanja.

### S7 - Ko učestvuje
- Učesnici: Ana, Marko, Iva
- Ana plaća 60,00 € za Ana i Marko (Iva nije učestvovala)
- Udjeli: 30,00 € Ana, 30,00 € Marko; Iva nema udio
- Rezultat: Marko → Ana 30,00 €
- Unos bez izabranog učesnika (`[]`) → 400, trošak se ne čuva.

### S8 - Isplaćeno
- Dug iz S3: Iva → Ana 40,00 €
- Označi "Isplaćeno" za Iva → Ana 40,00 € → taj dug nestaje iz liste, ostaje Marko → Ana 10,00 €
- Poništi isplatu → Iva → Ana 40,00 € se vraća
- Plaćanje sa iznosom koji nije otvoren dug (npr. 35,00 €) → 400 "Ovaj dug više nije otvoren. Osvježite stranicu."

### S9 - Brisanje troška
- Obriši "Taksi" (30,00 €, Marko) iz S3 → ostaje Ana 90,00 € za troje → Marko → Ana 30,00 €, Iva → Ana 30,00 €
- Brisanje nepostojećeg troška → 404.

## Šta nije obuhvaćeno
- Više valuta, više platilaca po jednom trošku, više korisnika ili registracija.
- Izmjena (edit) troška ili učesnika. Brisanje učesnika.
- Dijeljenje grupe između korisnika.
- Reset lozinke, uloge, rate limiting.
- Deploy na internet. Aplikacija radi lokalno.
