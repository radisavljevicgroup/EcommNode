# EcommNode — pravila za rad (obe Claude sesije/naloga)

Ovaj projekat se razvija paralelno sa dva Claude naloga na dva različita
računara. Ovaj fajl postoji da obe sesije prate ista pravila bez potrebe da
korisnik ručno prenosi instrukcije između njih.

## 1. Deploy pipeline — kako zapravo radi

`.cpanel.yml` na serveru (cPanel Git™ Version Control) radi ovo pri svakom
"Deploy":

```
cp -R repositories/ecommnode/server/*   → api.ecommnode.com/
npm install --prefix api.ecommnode.com/
cp -R repositories/ecommnode/app/dist/* → ecommnode.com/
```

**Ključno: deploy NE pokreće `npm run build`.** Samo kopira već postojeći
`app/dist/*` iz repo-a. Ako `dist/` nije sveže build-ovan i commitovan,
deploy fizički nema šta novo da prenese na frontend, bez obzira koliko puta
se pokrene.

### Pravilo pre svakog push-a koji dira frontend (`app/src/**`)

1. `git status` i `git diff` u `app/src/` — proveri da nema untracked ili
   nekomitovanih fajlova (posebno nove komponente/JSX fajlove).
2. Pokreni `npm run build` u `app/`.
3. Commit **i source i dist zajedno**, u istom push-u:
   `git add app/src app/dist && git commit && git push`.
4. Nikad ne commituj samo `dist/` bez odgovarajućih `src/` izmena, niti samo
   `src/` bez rebuild-ovanog `dist/`. Ako menjaš `app/src`, `app/dist` mora
   biti u istom commitu (ili odmah sledećem, pre deploy-a).

### Pre nego što kažeš korisniku "gurnuto je, pokreni deploy"

Proveri da `git diff --stat <prethodni-commit> <novi-commit>` pokazuje
promene i u `app/src/` i u `app/dist/` kad god je frontend menjan — ako
menja samo jedno od to dvoje, nešto nedostaje.

## 2. Integracije (WooCommerce, GA4, GSC, Eurocom, Meta inbox, kalendar...)

**Ovo nikad neće stići preko git-a — i ne treba da stigne.**

`server/.gitignore` namerno isključuje `data/`:
```
node_modules
.env
data/
premium/
```

Sve konekcije (`server/lib/store.js`, `ga4Store.js`, `gscStore.js`,
`shopifyStore.js`, `inboxConnectionsStore.js`, `calendarStore.js`,
`metaStore.js`, `settingsStore.js`) čuvaju se kao **lokalni JSON fajlovi na
disku servera koji ih pokreće** (`server/data/*.json`), ne u Supabase bazi.
Sadrže plain-text tajne (WooCommerce consumer key/secret, OAuth tokeni) —
namerno nisu u git istoriji.

Posledica: integracija napravljena na lokalnom računaru postoji SAMO tamo.
Push/pull/deploy je nikad neće preneti na produkciju — ni greškom, ni
namerno, jer `data/` fizički nije deo git repo-a ni na jednom kraju.

### Šta reći korisniku kad pita zašto integracija "nije stigla"

Objasni da integracije nisu kod nego runtime-podaci vezani za mašinu koja
vodi taj server proces, i uputi na jednu od dve opcije ispod (3. sekcija).

## 3. Radni tok: lokalno testiranje → produkcija

- **Eurocom automatski sync je implementiran u kodu**, ne kao eksterni
  cPanel Cron Job (ranija pretpostavka u ovom fajlu je bila pogrešna — do
  te tačke `/eurocom/sync` uopšte nije pisao u WooCommerce, vraćao je 501).
  `server/premium/eurocom/scheduler.js` koristi `node-cron`: zalihe na sat
  (`0 * * * *`), cene jednom dnevno u 03:00 (`0 3 * * *`), za svaku
  konekciju kod koje je odgovarajuća opcija (`stock`/`price`) uključena.
  Stvarno pisanje u WooCommerce (mapiranje Eurocom `barCode` ↔ Woo `sku`,
  `my_price.with_vat` → `regular_price`, `stock` → `stock_quantity`) je u
  `server/premium/eurocom/sync.js`.
- **Scheduler je ugašen po default-u** — pokreće se samo ako je
  `EUROCOM_AUTOSYNC=true` u `.env` (vidi `server/.env.example`). Ovo mora
  biti postavljeno na produkciji da bi automatski sync uopšte radio, i
  NIKAD ne sme biti postavljeno na lokalnoj/dev mašini koja je povezana na
  pravu WooCommerce prodavnicu.
- **Nikad ne povezuj pravu/produkcionu WooCommerce prodavnicu (ili pravi
  GA4/GSC/Eurocom nalog klijenta) sa lokalnog dev servera**, i nikad ne
  postavljaj `EUROCOM_AUTOSYNC=true` lokalno dok je takva konekcija
  aktivna. Dokle god se to ne uradi, nema sudara — lokalni sync se dešava
  samo na ručni klik/poziv (scheduler je isključen), live ide po
  rasporedu nezavisno. Ali ako neko ručno pokrene sync lokalno protiv iste
  prave prodavnice dok scheduler paralelno radi na produkciji, oba pišu u
  isti spoljni sistem bez koordinacije — moguće duplirane/konfliktne
  izmene cena i zaliha.
- **Poznato ograničenje:** mapiranje po `programs` (`level_1a`/`level_1b`)
  koristi placeholder kodove iz `app/src/premium/eurocom/catalog.js` koji
  nisu potvrđeni protiv stvarnog Eurocom API-ja (nema još poziva na
  `GET /api/programs` da se potvrde pravi kodovi). Filter po `brands`
  (`brand_code`) jeste potvrđen i pouzdan. Dok se programi ne potvrde,
  filtriranje po programu može vratiti prazan/pogrešan rezultat.
- Za lokalni razvoj koristi **test/sandbox WooCommerce prodavnicu** (ili
  test GA4/GSC property), nikad pravi klijentski nalog.
- Kad je feature gotov i kod je na produkciji: integracija se **ponovo,
  ručno** povezuje direktno na live sajtu (Podešavanja → Integracije), sa
  pravim kredencijalima. To je normalan i očekivan korak, ne workaround.
- Ako je baš potrebno preneti postojeću lokalnu konekciju (a ne samo
  ponovo je povezati): ručno kopiraj konkretan `server/data/*.json` fajl
  na server preko SFTP/cPanel File Manager-a, van git-a. Ovo nosi rizik
  (tajne u plaintext-u putuju van git-a) — koristi samo kad je stvarno
  potrebno i preko sigurnog kanala.

## 4. Opšte

- Pre nego što bilo koja sesija pokrene `npm run build` u `app/`, proveri
  da li postoje nekomitovane izmene u `app/src` koje ta build sesija nema
  lokalno (npr. `git fetch` pa uporedi) — build sa nepotpunim source-om
  briše tuđi rad iz `dist/`.
- Baza (Supabase, `iwixrkrsurdpdiamszdw.supabase.co`) je deljena između
  local i produkcije — nalozi, firme/company scoping i slično su tu, pa se
  VIDE svuda. Integracije/konekcije (sekcija 2) nisu u bazi i NE dele se.
