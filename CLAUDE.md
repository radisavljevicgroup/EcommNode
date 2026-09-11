# EcommNode — pravila za rad (obe Claude sesije/naloga)

Ovaj projekat se razvija paralelno sa dva Claude naloga na dva različita
računara. Ovaj fajl postoji da obe sesije prate ista pravila bez potrebe da
korisnik ručno prenosi instrukcije između njih.

## 0. Na početku SVAKE sesije, pre bilo kakve izmene: povuci oba repo-a

Pre nego što se dirne bilo koji fajl (kod, config, čak i ovaj CLAUDE.md),
prvo proveri da li je druga sesija/računar u međuvremenu nešto
push-ovao — u OBA repo-a, ne samo u glavnom:

```bash
cd EcommNode          && git fetch origin && git log HEAD..origin/main --oneline
cd ../ecommnode-premium && git fetch origin && git log HEAD..origin/main --oneline
```

- Ako bilo koja komanda ispiše commit-e → to je rad druge sesije koji
  lokalno ne postoji. Uradi `git pull --ff-only` na oba repo-a PRE nego
  što počneš svoj zadatak (ne posle) — u suprotnom radiš na zastareloj
  osnovi i rizikuješ upravo ono što se desilo 2026-09-10: build/izmena
  napravljena bez najnovijeg stanja drugog računara je izgledala uspešno
  lokalno, ali je na produkciji tiho izostavila/pregazila tuđi rad (vidi
  sekciju 1, "Pre SVAKOG `npm run build`").
- Ako `git pull --ff-only` odbije zbog lokalnih nekomitovanih izmena —
  ne diraj ih nasilno (bez `reset --hard`/`checkout --`). Prvo pogledaj
  šta je to (`git status`, `git diff`) — verovatno je nedovršen rad ove
  iste sesije od ranije (ili mašinski-specifične izmene poput
  `app/vite.config.js` / `.claude/launch.json` putanja, koje i ne treba
  da se commituju, vidi sekciju 4) — pa tek onda odluči da li da
  stash-uješ, commituješ ili ostaviš netaknuto.
- Ovo ne zamenjuje pravila iz sekcije 1 (rebuild `dist/` pre push-a,
  provera pre "gurnuto je, deploy-uj") — to je provera PRE početka rada,
  ne pred kraj. Pravilo iz sekcije 1 i "Opšte" (sekcija 4) i dalje važi
  neposredno pre samog `npm run build`/push-a, jer druga sesija može
  pushovati i USRED tvog rada.

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

### Pre SVAKOG `npm run build`: proveri da je `ecommnode-premium` checkout ažuran

Otkriveno 2026-09-10: `app/src/premium` i `server/premium` su Windows
junction-ovi (simlinkovi) ka lokalnom checkout-u
[ecommnode-premium](https://github.com/radisavljevicgroup/ecommnode-premium)
na tom istom računaru (vidi sekciju 3). `AlatiSection.jsx`,
`ItInfrastruktura.jsx` i `Analytics.jsx` koriste
`import.meta.glob("../premium/*/...")` da pokupe premium module — ako
folder za neki modul (npr. `stock-control`) fizički ne postoji u lokalnom
`ecommnode-premium` checkout-u u trenutku kad se `npm run build` pokrene
(jer taj checkout nije `git pull`-ovan, pa mu fali commit koji je taj
folder dodao), Vite ga **tiho izostavi iz bundle-a** — bez ijedne greške
ili warning-a pri build-u. Rezultat: `npm run build` "uspe", `dist/` se
commituje i deploy-uje normalno, ali ceo alat (kartica u "Alati", tab u
IT Infrastrukturi...) nestane sa live sajta kao da nikad nije ni pisan —
lako zavara na "nešto je sa deploy-om/git-om", kad je zapravo stvar u
tome da je build napravljen sa zastarelim lokalnim `premium/` checkout-om.

Zato, pre SVAKOG `npm run build` u `app/` (na bilo kom od dva računara):

```bash
cd <putanja-do-ecommnode-premium>   # na ovom računaru: C:\Users\MarkoJ\ecommnode-premium
git pull origin main
cd ../EcommNode/app
npm run build
```

Posle build-a, ako je nešto u premium modulima menjano nedavno, brzo
proveri da je stvarno ušlo u bundle pre commit-a:

```bash
grep -o "<neki tekst jedinstven za taj modul>" dist/assets/index-*.js
```

Prazan rezultat = modul nije ušao u build → proveri `ecommnode-premium`
checkout (git log/status) pre nego što nastaviš.

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
- **Bag nađen i ispravljen 2026-09-11** (ecommnode-premium): Eurocom-ov
  stock sync (`computeUpdates` u `sync.js`) je pisao samo `stock_quantity`
  u WooCommerce, nikad `stock_status`. WooCommerce REST API **ne**
  preračunava `stock_status` iz `stock_quantity` sam od sebe (to se dešava
  samo kroz wp-admin editor pri snimanju proizvoda i pri checkout-u, ne pri
  API pozivu) — pa je artikal koji je jednom pao na "outofstock" ostajao
  zauvek tako obeležen na sajtu, čak i kad bi Eurocom kasnije vratio
  zalihu i sync ispravno podigao `stock_quantity`. Ovo je direktno
  pokvarilo **stock-control** modul (`server/premium/stock-control`): on
  odlučuje da li je artikal "vratio zalihu" isključivo preko
  `stock_status`, pa artikli koje je draft-ovao zbog nestašice nikad nisu
  automatski vraćani u "publish" dok god je njihov `stock_status` ostajao
  lažno "outofstock" — potvrđeno na CASMS20BK2 (casiosrbija.rs). Ispravka:
  `computeUpdates` sad svaki put računa `stock_status` iz Eurocom-ove
  vrednosti (`instock`/`outofstock`) i piše ga kad god se razlikuje od
  trenutnog stanja na sajtu — nezavisno od toga da li se `stock_quantity`
  te iteracije promenio — tako da se već pokvareni artikli sami isprave na
  sledećem sync-u, bez ručne intervencije. `.env.example` je takođe imao
  rupu: `STOCK_CONTROL_AUTOSYNC` (analogno `EUROCOM_AUTOSYNC`) uopšte nije
  bio dokumentovan tamo — dodato; proveri da li je stvarno postavljen na
  `true` na produkciji, jer bez njega `startScheduler()` u
  `stock-control/scheduler.js` odmah izlazi i automatska provera se nikad
  ne pokreće.
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
  briše tuđi rad iz `dist/`. **I** proveri da je lokalni
  `ecommnode-premium` checkout `git pull`-ovan na najnoviji `origin/main`
  pre tog istog build-a — vidi sekciju 1, "Pre SVAKOG `npm run build`" —
  jer zastareo premium checkout ne baca grešku, samo tiho izbaci ceo alat
  iz bundle-a.
- Kad korisnik javi da je nešto što je juče radilo na produkciji danas
  nestalo (alat, integracija, dugme...) — prvo proveri git istoriju i
  reflog na oba repo-a (`EcommNode` i `ecommnode-premium`) da isključiš
  "izgubljen commit" (retko, obično nije to). Ako je istorija netaknuta,
  sumnjaj redom na: (1) cPanel deploy koji kasni za GitHub-om (uporedi
  HEAD Commit vs. Last Deployed SHA za OBA repo-a posebno, ne samo za
  glavni), (2) stari Node worker proces koji nije ubijen posle deploy-a
  (sekcija 1), (3) bundle napravljen sa zastarelim `ecommnode-premium`
  checkout-om (ovaj odeljak, iznad) — ovo poslednje pogađa baš alate koji
  su "bili tu juče, nema ih danas" bez ikakve vidljive greške, i lako se
  pomeša sa (1) ili (2) dok se stvarno ne proveri sadržaj bundle-a
  (`grep` po tekstu jedinstvenom za taj alat u `dist/assets/index-*.js`).
- Baza (Supabase, `iwixrkrsurdpdiamszdw.supabase.co`) je deljena između
  local i produkcije — nalozi, firme/company scoping i slično su tu, pa se
  VIDE svuda. Integracije/konekcije (sekcija 2) nisu u bazi i NE dele se.
