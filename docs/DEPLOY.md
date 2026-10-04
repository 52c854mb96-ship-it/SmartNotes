# Ta i bruk SmartNotes

For at notatene skal synkroniseres mellom enhetene dine, må serveren kjøre et sted som alltid er på. Du har tre alternativer:

- **A. Railway** (anbefalt, du har abonnement der): ingen maskin å passe på, HTTPS følger med, og nye versjoner deployes automatisk fra GitHub.
- **B. Fly.io**: samme type tjeneste, styres med terminalen. Koster ca. 60–70 kr/mnd.
- **C. Egen maskin med Docker**: en PC, NAS eller Raspberry Pi som står på hjemme.

Alle bruker samme Docker-image, med Node.js, TeX Live og poppler. Containeren starter som root bare for å gi lagringsvolumet til brukeren `node` (`scripts/docker-entrypoint.sh`); selve serveren kjører som `node`.

---

## A. Railway

Følg **[OPPSETT.md](OPPSETT.md)**, steg 4–6. Kort fortalt:

- Én tjeneste med et volum montert på `/data`, i regionen EU West.
- Variablene `APP_PASSWORD`, `ANTHROPIC_API_KEY` og `PORT=8080`, og et domene som peker til port 8080.
- Prosjektet lages med **Deploy from GitHub repo** (grenen `main`, med **Wait for CI**). Railway leser `railway.json`: bygg med `Dockerfile`, helsesjekk på `/api/health` og omstart ved feil.

Andre innstillinger fra tabellen i README (f.eks. `CLAUDE_EFFORT`) legges inn som variabler på samme måte.

---

## B. Fly.io

### 1. Installer verktøyet og logg inn

```bash
brew install flyctl                  # macOS
# eller: curl -L https://fly.io/install.sh | sh
fly auth signup                      # eller: fly auth login
```

Fly.io krever et betalingskort på kontoen.

### 2. Opprett appen

Velg et unikt navn, f.eks. `smartnotes-kari`, og bruk det i stedet for `smartnotes-ditt-navn` i `fly.toml`:

```bash
fly apps create smartnotes-kari
```

### 3. Lag et lagringsvolum

Volumet holder på databasen, originalbildene og PDF-ene:

```bash
fly volumes create smartnotes_data --region arn --size 3
```

3 GB holder til mange tusen sider. Volumet kan utvides senere med `fly volumes extend`.

### 4. Legg inn hemmelighetene

```bash
fly secrets set APP_PASSWORD='et-langt-unikt-passord' ANTHROPIC_API_KEY='sk-ant-...'
```

API-nøkkelen lager du på <https://console.anthropic.com> → *API Keys*. Den lagres kryptert hos Fly.io og havner verken i git eller i nettleseren.

### 5. Deploy

```bash
fly deploy --ha=false
```

`--ha=false` gir én maskin, som passer med ett lagringsvolum. Det første bygget tar noen minutter fordi TeX Live skal installeres. Når det er ferdig, åpner du `https://smartnotes-kari.fly.dev` og logger inn.

### 6. Installer som app

| Enhet | Slik gjør du |
|---|---|
| iPhone / iPad (Safari) | Del-knappen → **Legg til på Hjem-skjerm** |
| Android (Chrome) | Meny ⋮ → **Installer app** |
| Mac (Chrome / Edge) | Installer-ikonet til høyre i adressefeltet |
| Mac (Safari) | **Arkiv → Legg til i Dock** |
| Windows (Chrome / Edge) | Installer-ikonet i adressefeltet |

Logg inn én gang på hver enhet mens du er på nett. Etter det fungerer appen offline.

### Oppdatere

```bash
git pull
fly deploy --ha=false
```

### Sikkerhetskopi

Fly.io tar daglige øyeblikksbilder av volumet (`fly volumes snapshots list`). Du kan også hente ut databasen selv:

```bash
fly ssh sftp get /data/smartnotes.db ./smartnotes-backup.db
```

### Feilsøking

```bash
fly logs               # serverlogg (konverteringer, feil fra Claude/LaTeX)
fly status
fly ssh console        # skall inne i maskinen; data ligger i /data
```

---

## C. Egen maskin med Docker

```bash
cp .env.example .env          # fyll inn APP_PASSWORD og ANTHROPIC_API_KEY
docker compose up -d --build
```

Appen kjører da på port 8080, og dataene ligger i `./data`.

**Viktig om HTTPS.** Nettlesere tillater bare installering og offline-modus (service worker) over HTTPS, eller på `http://localhost`. Innloggingen krever også HTTPS i produksjon. Enkle måter å få HTTPS hjemme på:

- **Tailscale.** Installer Tailscale på serveren og enhetene dine og kjør `tailscale serve --bg 8080`. Appen nås da på `https://<maskin>.<tailnet>.ts.net` fra alle enhetene dine, også når du er borte.
- **Cloudflare Tunnel** eller en reverse proxy som **Caddy** med eget domene.

Hvis du absolutt må kjøre uten HTTPS på et lukket nett, sett `COOKIE_SECURE=false`. Da virker ikke offline-modus.
