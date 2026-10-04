// Genererer PNG-ikoner for PWA-manifestet fra web/public/icon.svg.
// Kjør fra repo-roten:  node web/scripts/gen-icons.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const source = await readFile(join(publicDir, 'icon.svg'), 'utf8');

const bgColor = source.match(/<rect id="bg"[^>]*fill="([^"]+)"/)?.[1] ?? '#1F5FAD';
const mark = source.match(/<g id="mark">([\s\S]*?)<\/g>/)?.[1];
if (!mark) throw new Error('Fant ikke <g id="mark"> i icon.svg');

/** Fullflate-variant (ingen avrundede hjørner) med merket skalert rundt sentrum. */
function fullBleed(scale) {
  const offset = 256 * (1 - scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bgColor}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>
</svg>`;
}

async function render(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 72 * (size / 512) * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, file));
  console.log(`laget ${file} (${size}×${size})`);
}

await render(source, 192, 'icon-192.png');
await render(source, 512, 'icon-512.png');
// Maskerbart ikon: innholdet må ligge innenfor den sentrale sirkelen (80 %).
await render(fullBleed(0.74), 512, 'icon-maskable-512.png');
// iOS runder hjørnene selv og liker ikke gjennomsiktighet.
await render(fullBleed(0.86), 180, 'apple-touch-icon.png');
await render(source, 32, 'favicon-32.png');

