# Ta i bruk SmartNotes

For at notatene skal synkroniseres mellom enhetene dine, må serveren kjøre et sted som alltid er på. Du har to alternativer:

- **A. Fly.io** (anbefalt): ingen maskin å passe på, og HTTPS følger med. Koster ca. 40–60 kr/mnd.
- **B. Egen maskin med Docker**: en PC, NAS eller Raspberry Pi som står på hjemme.

Begge bruker samme Docker-image, med Node.js, TeX Live og poppler.

---

## A. Fly.io

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
fly deploy
```

Det første bygget tar noen minutter fordi TeX Live skal installeres. Når det er ferdig, åpner du `https://smartnotes-kari.fly.dev` og logger inn.

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
fly deploy
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

## B. Egen maskin med Docker

```bash
cp .env.example .env          # fyll inn APP_PASSWORD og ANTHROPIC_API_KEY
docker compose up -d --build
```

Appen kjører da på port 8080, og dataene ligger i `./data`.

**Viktig om HTTPS.** Nettlesere tillater bare installering og offline-modus (service worker) over HTTPS, eller på `http://localhost`. Innloggingen krever også HTTPS i produksjon. Enkle måter å få HTTPS hjemme på:

- **Tailscale.** Installer Tailscale på serveren og enhetene dine og kjør `tailscale serve --bg 8080`. Appen nås da på `https://<maskin>.<tailnet>.ts.net` fra alle enhetene dine, også når du er borte.
- **Cloudflare Tunnel** eller en reverse proxy som **Caddy** med eget domene.

Hvis du absolutt må kjøre uten HTTPS på et lukket nett, sett `COOKIE_SECURE=false`. Da virker ikke offline-modus.

---

## Automatisk deploy fra GitHub (valgfritt)

1. Lag et token med `fly tokens create deploy`.
2. Legg det inn som repository secret `FLY_API_TOKEN` på GitHub.
3. Legg til en workflow som kjører `flyctl deploy --remote-only` ved push til `main`, f.eks. med `superfly/flyctl-actions/setup-flyctl@master`.
