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

### Posle SVAKOG deploy-a koji dira `server/*` (uključujući `server/premium/`
### preko posebnog `ecommnode-premium` deploy-a): ubij Node proces ručno

Otkriveno 2026-09-08 dok je debugovan Eurocom autosync koji "nije radio"
uprkos ispravnom kodu i env-u: cPanel-ovo dugme **Restart** u Setup Node.js
App NE ubija pouzdano stari worker proces (CloudLinux `lsnode`/Node
Selector). Posle deploy-a, stari proces često nastavlja da radi sa starim
kodom u memoriji — novi fajlovi su na disku, ali se ne koriste dok se
proces ne ubije i LSAPI ne spawn-uje nov worker na sledeći zahtev.

Nakon svakog deploy-a koji menja bilo šta u `server/` (ne samo
`premium/`), preko SSH:
```bash
ps aux | grep -i node
kill <pid od lsnode:/home/radisavl/api.ecommnode.com/>
curl -s -o /dev/null -w "%{http_code}\n" https://api.ecommnode.com/
```
Poslednja komanda budi LSAPI da odmah spawn-uje svež proces (umesto da
čeka prvi pravi korisnički zahtev). Bez ovog koraka, deploy izgleda uspešan
(fajlovi, git log, "Last Deployed" sve pokazuju novo stanje) ali live
ponašanje ostaje staro — lako zavara i korisnika i sesiju koja debaguje na
osnovu onoga što misli da je "sigurno već live".

`node`/`npm` nisu u PATH-u u SSH sesiji po default-u (CloudLinux Node
Selector) — za ručno testiranje (`node -e "require(...)"` i sl.):
```bash
source ~/nodevenv/api.ecommnode.com/<verzija>/bin/activate   # verzija: ls ~/nodevenv/api.ecommnode.com/
```

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
  `server/premium/eurocom/scheduler.js` koristi obično `setInterval`
  (bez biblioteke — nema `node-cron` zavisnosti): zalihe na svakih sat
  vremena, cene na svakih 24h **od trenutka kad server proces krene**
  (nije fiksno vreme kao "03:00", nego 24h od boot-a), za svaku konekciju
  kod koje je odgovarajuća opcija (`stock`/`price`) uključena. Stvarno
  pisanje u WooCommerce (mapiranje Eurocom `ID` ↔ Woo `sku`, uz opciju
  price-multiplier po brendu, `price.with_vat × multiplier` →
  `regular_price`, `stock` → `stock_quantity`, piše samo kad se vrednost
  stvarno promenila) je u `server/premium/eurocom/sync.js`. Isti fajl ima
  i `runDiff` (koristi ga `GET /eurocom/diff`) za poređenje Eurocom
  kataloga vs. stanja na sajtu bez pisanja.
- **`server/premium/` NIJE ad-hoc vendorovan fajl-po-fajl — to je poseban
  git repo, [ecommnode-premium](https://github.com/radisavljevicgroup/ecommnode-premium),
  klonirán odvojeno i simlinkovan/kopiran u `server/premium` (na ovom
  računaru: `C:\Users\MarkoJ\ecommnode-premium`, simlink na
  `EcommNode/server/premium`). Zato ga glavni `EcommNode` repo ignoriše
  (`.gitignore: premium/`) — izmene u `server/premium/**` se commituju i
  pushuju u **`ecommnode-premium`**, ne u `EcommNode`. Na produkciji
  korisnik ima svoj checkout tog repo-a i ažurira ga sa `git pull` —
  proveri UVEK da li je taj checkout na serveru ažuran pre nego što
  pretpostaviš da live kod odgovara onome što vidiš lokalno.
- **Scheduler je ugašen po default-u** — pokreće se samo ako je
  `EUROCOM_AUTOSYNC=true` u `.env` (vidi `server/.env.example`). Ovo mora
  biti postavljeno na produkciji da bi automatski sync uopšte radio, i
  NIKAD ne sme biti postavljeno na lokalnoj/dev mašini koja je povezana na
  pravu WooCommerce prodavnicu. Provera stvarno postoji u kodu, na početku
  `startScheduler()` u `ecommnode-premium/server/premium/eurocom/scheduler.js`
  (`if (process.env.EUROCOM_AUTOSYNC !== "true") return;`, dodato
  2026-09-07 commit-om `c763345`) — nemoj ponovo "otkrivati" ovaj bag bez
  da prvo pull-uješ `ecommnode-premium` na najnoviji `origin/main`, jer je
  lokalni checkout lako zaostati za onim što je zapravo na GitHub-u.
  Logovanje po tick-u/konekciji (`[eurocom-sync] ...`) dodato istog dana
  commit-om `58b8909` — ako korisnik javi da automatski sync i dalje ne
  radi uprkos `EUROCOM_AUTOSYNC=true`, prva stvar je da proveri te logove
  na produkciji (potvrđuje da li scheduler uopšte tik-uje i šta sync javlja
  po konekciji), druga da proveri da li je produkcioni checkout
  `ecommnode-premium` ažuran.
  Takođe: `setInterval` ne pokreće prvi sync odmah — prvi stock tick tek
  posle punog sata, prvi price tick posle punih 24h *neprekidnog* rada tog
  Node procesa od poslednjeg starta. Ako platforma (npr. cPanel/Passenger)
  restartuje proces zbog neaktivnosti pre nego što taj interval prođe,
  automatski sync nikad ne stigne da opali.
- **Nikad ne povezuj pravu/produkcionu WooCommerce prodavnicu (ili pravi
  GA4/GSC/Eurocom nalog klijenta) sa lokalnog dev servera**, i nikad ne
  postavljaj `EUROCOM_AUTOSYNC=true` lokalno dok je takva konekcija
  aktivna. Dokle god se to ne uradi, nema sudara — lokalni sync se dešava
  samo na ručni klik/poziv (scheduler je isključen), live ide po
  rasporedu nezavisno. Ali ako neko ručno pokrene sync lokalno protiv iste
  prave prodavnice dok scheduler paralelno radi na produkciji, oba pišu u
  isti spoljni sistem bez koordinacije — moguće duplirane/konfliktne
  izmene cena i zaliha.
- **Poznato ograničenje:** `syncOptions.programs` se čuva (podešava se u
  UI-ju) ali `fetchEurocomCatalog` u `sync.js` trenutno filtrira **samo**
  po `brands` — izbor programa (Škola, Kancelarija...) se ne primenjuje
  nigde u sync/diff logici, sync ide preko celog kataloga (ili filtriranog
  po brendu ako je brend izabran). Ako se ovo doda kasnije, kodovi u
  `app/src/premium/eurocom/catalog.js`'s `EUROCOM_PROGRAMS` su placeholderi
  — nisu potvrđeni protiv `level_1a`/`level_1b` iz stvarnog API-ja.
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
