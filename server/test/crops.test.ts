import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cropFigure, figureIds } from '../src/pipeline/images.js';

/**
 * Utklipp: lagres som JPEG når det sparer minst 30 prosent (fotografier og håndskrevne sider, som er JPEG fra før), ellers
 * som PNG. LaTeX finner begge, fordi `\originalfigur` bruker navnet uten filendelse.
 */
describe('utklipp', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-utklipp-'));
  const page = { width: 800, height: 600 };

  it('lagrer et fotografi som JPEG', async () => {
    // Støy i alle farger ligner et fotografi: PNG blir stor, JPEG liten.
    const raw = Buffer.alloc(page.width * page.height * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
    const file = path.join(dir, 'foto.jpg');
    await sharp(raw, { raw: { ...page, channels: 3 } }).jpeg({ quality: 92 }).toFile(file);
    const out = path.join(dir, 'figures-foto');
    fs.mkdirSync(out);
    expect(await cropFigure(file, page, [100, 100, 700, 500], path.join(out, 'fig1.png'))).toBe(true);
    expect(fs.readdirSync(out)).toEqual(['fig1.jpg']);
  });

  it('lagrer en strektegning fra et sidebilde som JPEG, og en flate uten detaljer som PNG', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#fbfaf6"/>
      <line x1="120" y1="480" x2="680" y2="140" stroke="#222" stroke-width="5"/><circle cx="400" cy="300" r="120" stroke="#222" stroke-width="5" fill="none"/></svg>`;
    const file = path.join(dir, 'tegning.jpg');
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(file);
    const out = path.join(dir, 'figures-tegning');
    fs.mkdirSync(out);
    expect(await cropFigure(file, page, [100, 100, 700, 500], path.join(out, 'fig1.png'))).toBe(true);
    // Hjørnet uten noe tegnet er en ren flate.
    expect(await cropFigure(file, page, [600, 500, 790, 590], path.join(out, 'fig2.png'))).toBe(true);
    expect(fs.readdirSync(out).sort()).toEqual(['fig1.jpg', 'fig2.png']);
  });

  it('kjenner igjen figurene uansett filendelse', () => {
    expect([...figureIds(['fig1.png', 'fig2.jpg', 'notat.tex', 'fig3.jpeg'])]).toEqual(['fig1', 'fig2']);
  });
});
