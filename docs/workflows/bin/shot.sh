#!/usr/bin/env bash
# Skjermbilder av visualiseringer under en lås (høyst to Chromium samtidig). Samme argumenter som web/scripts/viz-shot.mjs:
#   shot.sh --ids k5-gass,k5-eks-kalorimeter --out <mappe>      (port 5173 og Chromium settes her)
#   shot.sh --fag kjemi --chapter 3 --extremes --themes light --out <mappe>
# Krever at Vite kjører på port 5173 (se docs/workflows/README.md).
cd "$(dirname "$0")/../../../web" || exit 1
slot=$(( (RANDOM % 2) + 1 ))
for s in 1 2; do
  if flock -n /tmp/smartnotes-shot-$s.lock true 2>/dev/null; then slot=$s; break; fi
done
PW_CHROMIUM=/opt/pw-browsers/chromium flock /tmp/smartnotes-shot-$slot.lock node scripts/viz-shot.mjs --port 5173 "$@"
