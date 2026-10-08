#!/usr/bin/env bash
# Typesjekk av web-appen under en lås (mange agenter deler maskinen), filtrert på en sti.
#   tsc-sjekk.sh src/viz/fysikk/kap05        → bare feil i kapittelmappa (og i kit/, som alle bruker)
#   tsc-sjekk.sh                             → alle feil
cd "$(dirname "$0")/../../../web" || exit 1
out=$(mktemp)
flock /tmp/smartnotes-tsc.lock npx tsc -p tsconfig.json --noEmit > "$out" 2>&1
code=$?
if [ -n "$1" ]; then
  grep -E "^($1|src/viz/kit/)" "$out" || echo "Ingen typefeil i $1 eller src/viz/kit/ (tsc-kode $code for hele prosjektet)"
else
  cat "$out"; echo "tsc-kode $code"
fi
rm -f "$out"
