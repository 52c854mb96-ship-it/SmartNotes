#!/usr/bin/env bash
# Røyktest mot en kjørende SmartNotes-server med falsk Claude:
# logger inn, laster opp en side, venter på konvertering og henter PDF-en.
#   BASE=http://localhost:8080 PASSWORD=test scripts/smoke-test.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8080}"
PASSWORD="${PASSWORD:-test}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/jar"
H=(-H 'x-smartnotes: 1')

json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(eval('o'+process.argv[1]))})" "$1"; }

curl -sf "$BASE/api/health" | grep -q '"latex":true' || { echo "LaTeX mangler på serveren"; exit 1; }
curl -sf -c "$JAR" "${H[@]}" -H 'content-type: application/json' -d "{\"password\":\"$PASSWORD\"}" "$BASE/api/auth/login" >/dev/null
SUBJECT="$(curl -sf -b "$JAR" "$BASE/api/sync?since=0" | json '.subjects[0].id')"

# Et lite PNG-bilde (64×64, hvitt)
node -e "
const zlib=require('zlib');const w=64,h=64;const raw=Buffer.alloc((w*3+1)*h,255);for(let y=0;y<h;y++)raw[y*(w*3+1)]=0;
const crc=(b)=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let x=0xffffffff;for(const v of b)x=t[(x^v)&255]^(x>>>8);return (x^0xffffffff)>>>0};
const chunk=(type,data)=>{const l=Buffer.alloc(4);l.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
process.stdout.write(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
" > "$TMP/page.png"

NOTE="$(curl -sf -b "$JAR" "${H[@]}" -F "subjectId=$SUBJECT" -F "clientId=smoke-$(date +%s)" -F "files=@$TMP/page.png;type=image/png" "$BASE/api/notes" | json '.id')"
echo "Lastet opp notat $NOTE"
for i in $(seq 1 90); do
  STATUS="$(curl -sf -b "$JAR" "$BASE/api/sync?since=0" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const n=JSON.parse(s).notes.find(n=>n.id==='$NOTE');console.log(n.status+(n.error?': '+n.error:''))})")"
  case "$STATUS" in
    done) break ;;
    failed*) echo "Konvertering feilet: $STATUS"; exit 1 ;;
  esac
  sleep 2
done
[ "$STATUS" = done ] || { echo "Tidsavbrudd ($STATUS)"; exit 1; }
curl -sf -b "$JAR" "$BASE/api/notes/$NOTE/pdf" -o "$TMP/note.pdf"
head -c 4 "$TMP/note.pdf" | grep -q '%PDF' || { echo "Fikk ikke PDF"; exit 1; }
curl -sf "$BASE/" | grep -qi '<html' || { echo "Web-appen serveres ikke"; exit 1; }
echo "Røyktest OK"
