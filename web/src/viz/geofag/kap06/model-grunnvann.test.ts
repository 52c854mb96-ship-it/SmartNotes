import { describe, expect, it } from 'vitest';
import { SEK_PER_DOGN, reisetidDarcy } from '../kit/hydrologi';
import {
  AKER_AVSTAND_M,
  AVSTAND_MAKS_M,
  AVSTAND_MIN_M,
  BRONN_RADIUS_M,
  GRADIENT,
  KRAV_OPPHOLDSTID_DOGN,
  MAKS_SENKNING_M,
  MATERIAL_VALG,
  NITRAT_FORTYNNING,
  NITRAT_GRENSEVERDI,
  NITRAT_UNDER_AKER,
  PUMPERATER_LS,
  TYKKELSE_M,
  avstandEtter,
  avstandForReisetid,
  bronnstatus,
  fmtAvstand,
  fmtFart,
  fmtLs,
  fmtVarighet,
  materiale,
  nitratVedBronn,
  porefartVed,
  reiseTabell,
  reisetidMotBronn,
  senkningVed,
  smitteIgjen,
  smittebarriere,
  strom,
  strommodell,
} from './model-grunnvann';

const ingenFeiltall = (s: string) => expect(s).not.toMatch(/NaN|Infinity|undefined/);
/** Normaliserer mellomrom (fmt bruker hardt mellomrom som tusenskille). */
const tekst = (s: string) => s.replace(/[  ]/g, ' ');

describe('Darcys lov og porefart', () => {
  it('q = K · i', () => {
    for (const id of MATERIAL_VALG) {
      const m = materiale(id);
      const s = strom(id)!;
      expect(s.q).toBeCloseTo(m.K * GRADIENT, 20);
      expect(s.q / m.K).toBeCloseTo(GRADIENT, 12);
    }
  });

  it('porefarten er større enn Darcy-hastigheten (vannet går bare i porene)', () => {
    for (const id of MATERIAL_VALG) {
      const s = strom(id)!;
      expect(s.v).toBeGreaterThan(s.q);
      expect(s.v).toBeCloseTo(s.q / materiale(id).effektivPorositet, 20);
    }
  });

  it('meter per døgn i grus og millimeter per år i leire', () => {
    const grus = strom('grus')!.v * SEK_PER_DOGN;
    expect(grus).toBeGreaterThan(1);
    expect(grus).toBeLessThan(100);
    const leireMmPerAar = strom('leire')!.v * 365.25 * SEK_PER_DOGN * 1000;
    expect(leireMmPerAar).toBeGreaterThan(1);
    expect(leireMmPerAar).toBeLessThan(10);
    expect(tekst(fmtFart(strom('grus')!.v))).toBe('17 m/døgn');
    expect(tekst(fmtFart(strom('sand')!.v))).toBe('0,17 m/døgn');
    expect(tekst(fmtFart(strom('leire')!.v))).toBe('7,9 mm/år');
  });
});

describe('Reisetid uten pumping (kit-ets reisetidDarcy)', () => {
  it('reisetidDarcy = L/v', () => {
    const m = materiale('sand');
    const v = (m.K * GRADIENT) / m.effektivPorositet;
    expect(reisetidDarcy(60, GRADIENT, m.K, m.effektivPorositet)!).toBeCloseTo(60 / v / SEK_PER_DOGN, 6);
    expect(reisetidDarcy(120, GRADIENT, m.K, m.effektivPorositet)!).toBeCloseTo(2 * reisetidDarcy(60, GRADIENT, m.K, m.effektivPorositet)!, 6);
  });

  it('L = 0 gir 0, og gradient 0 gir null, aldri Infinity i teksten', () => {
    const m = materiale('sand');
    expect(reisetidDarcy(0, GRADIENT, m.K, m.effektivPorositet)).toBe(0);
    expect(reisetidDarcy(0, 0, m.K, m.effektivPorositet)).toBe(0);
    expect(reisetidDarcy(60, 0, m.K, m.effektivPorositet)).toBeNull();
    expect(reisetidDarcy(60, -0.01, m.K, m.effektivPorositet)).toBeNull();
    expect(reisetidDarcy(60, GRADIENT, m.K, 0)).toBeNull();
    expect(reisetidDarcy(Number.NaN, GRADIENT, m.K, m.effektivPorositet)).toBeNull();
    for (const t of [reisetidDarcy(60, 0, m.K, m.effektivPorositet), reisetidDarcy(0, GRADIENT, m.K, m.effektivPorositet), null]) ingenFeiltall(fmtVarighet(t));
    expect(fmtVarighet(null)).toBe('–');
  });

  it('leire gir mye lengre reisetid enn grus', () => {
    const t = (id: (typeof MATERIAL_VALG)[number]) => reisetidDarcy(60, GRADIENT, materiale(id).K, materiale(id).effektivPorositet)!;
    expect(t('leire') / t('grus')).toBeGreaterThan(1e5);
    expect(t('grus')).toBeLessThan(KRAV_OPPHOLDSTID_DOGN);
    expect(t('leire')).toBeGreaterThan(1000 * 365);
    // Rekkefølgen blant løsmassene
    expect(t('grus')).toBeLessThan(t('sand'));
    expect(t('sand')).toBeLessThan(t('silt'));
    expect(t('silt')).toBeLessThan(t('leire'));
  });
});

describe('Smittebarriere og nitrat', () => {
  it('minst 60 døgn i grunnen', () => {
    expect(smittebarriere(60, 'sand')!.oppfylt).toBe(true);
    expect(smittebarriere(60, 'sand')!.status).toBe('barriere');
    expect(smittebarriere(59.9, 'grus')!.oppfylt).toBe(false);
    expect(smittebarriere(59.9, 'grus')!.status).toBe('for-kort');
    expect(smittebarriere(88, 'silt')!.margin).toBeCloseTo(28, 10);
    expect(smittebarriere(null, 'sand')).toBeNull();
    expect(smittebarriere(Number.POSITIVE_INFINITY, 'sand')).toBeNull();
    expect(smittebarriere(-1, 'sand')).toBeNull();
  });

  it('oppsprukket fjell er aldri en hygienisk barriere ut fra oppholdstiden, selv med over 60 døgn', () => {
    // 60-døgnskravet gjelder løsmasser; i fjell kan vannet gå raskt i noen få åpne sprekker
    for (const t of [10, 63, 400, 10_000]) {
      const b = smittebarriere(t, 'oppsprukket-fjell')!;
      expect(b.oppfylt).toBe(false);
      expect(b.status).toBe('fjell');
      expect(b.langNok).toBe(t >= KRAV_OPPHOLDSTID_DOGN);
    }
    // Også i scenen: en tørr fjellbrønn med lang reisetid er ikke en barriere
    const bronn = bronnstatus('oppsprukket-fjell', 20)!;
    const t = reisetidMotBronn(AVSTAND_MAKS_M, strommodell('oppsprukket-fjell', bronn))!;
    expect(t).toBeGreaterThan(KRAV_OPPHOLDSTID_DOGN);
    expect(smittebarriere(t, 'oppsprukket-fjell')!.oppfylt).toBe(false);
  });

  it('nitratet når fram med c₀/fortynning uansett reisetid', () => {
    const c = nitratVedBronn(NITRAT_UNDER_AKER, NITRAT_FORTYNNING)!;
    expect(c).toBeCloseTo(NITRAT_UNDER_AKER / NITRAT_FORTYNNING, 12);
    expect(c).toBeLessThan(NITRAT_GRENSEVERDI);
    // Reisetiden fra åkeren er ulik for alle materialene, men den kommer alltid fram, og konsentrasjonen er den samme
    const tider = MATERIAL_VALG.map((id) => reisetidMotBronn(AKER_AVSTAND_M, strommodell(id, bronnstatus(id, 5))));
    for (const t of tider) {
      expect(t).not.toBeNull();
      expect(Number.isFinite(t!)).toBe(true);
    }
    expect(new Set(tider).size).toBe(tider.length);
    expect(nitratVedBronn(40, 1)).toBe(40);
    expect(nitratVedBronn(40, 0.5)).toBeNull();
    expect(nitratVedBronn(-1, 4)).toBeNull();
    expect(nitratVedBronn(40, Number.NaN)).toBeNull();
  });

  it('andelen smittestoff som er igjen, faller fra 1 til 0', () => {
    expect(smitteIgjen(0)).toBe(1);
    expect(smitteIgjen(KRAV_OPPHOLDSTID_DOGN)).toBeGreaterThan(0);
    expect(smitteIgjen(KRAV_OPPHOLDSTID_DOGN)).toBeLessThan(0.25);
    expect(smitteIgjen(1000)).toBe(0);
    expect(smitteIgjen(Number.NaN)).toBe(0);
  });
});

describe('Brønnen og senkningstrakten', () => {
  it('senkningen er null ved påvirkningsradien og øker inn mot brønnen', () => {
    const b = bronnstatus('sand', 5)!;
    expect(senkningVed(b, b.R)).toBe(0);
    expect(senkningVed(b, 2 * b.R)).toBe(0);
    let forrige = 0;
    for (const r of [b.R * 0.9, 100, 30, 10, 1, BRONN_RADIUS_M]) {
      const s = senkningVed(b, r);
      expect(s).toBeGreaterThan(forrige);
      forrige = s;
    }
    expect(senkningVed(b, BRONN_RADIUS_M)).toBeCloseTo(b.senkning, 10);
    // Thiem for sand med 5 l/s etter 30 døgn: ca. 3 m i brønnen og ca. 220 m påvirkningsradius
    expect(b.senkning).toBeGreaterThan(2.5);
    expect(b.senkning).toBeLessThan(3.6);
    expect(b.R).toBeGreaterThan(180);
    expect(b.R).toBeLessThan(260);
  });

  it('dyp og smal trakt i tette masser, grunn og vid i grus', () => {
    const grus = bronnstatus('grus', 0.2)!;
    const silt = bronnstatus('silt', 0.2)!;
    expect(grus.R).toBeGreaterThan(10 * silt.R);
    expect(silt.senkning).toBeGreaterThan(10 * grus.senkning);
  });

  it('leire gir nesten ikke vann: brønnen går tørr', () => {
    const leire = bronnstatus('leire', 0.1)!;
    expect(leire.torr).toBe(true);
    expect(leire.Q).toBeCloseTo(leire.Qmaks, 15);
    expect(leire.Qmaks * 1000 * 3600).toBeLessThan(10); // under 10 liter i timen
    expect(leire.senkning).toBeCloseTo(MAKS_SENKNING_M, 6);
    const grus = bronnstatus('grus', 20)!;
    expect(grus.torr).toBe(false);
    expect(grus.Q).toBeCloseTo(0.02, 12);
    // Oppsprukket fjell gir noen hundre liter i timen, som en vanlig fjellbrønn
    const fjell = bronnstatus('oppsprukket-fjell', 20)!;
    expect(fjell.torr).toBe(true);
    expect(fjell.Qmaks * 1000 * 3600).toBeGreaterThan(200);
    expect(fjell.Qmaks * 1000 * 3600).toBeLessThan(3000);
  });

  it('alle kombinasjoner på glidebryterne gir endelige tall', () => {
    for (const id of MATERIAL_VALG) {
      for (const q of PUMPERATER_LS) {
        const b = bronnstatus(id, q)!;
        expect(b).not.toBeNull();
        for (const v of [b.T, b.R, b.Qmaks, b.Q, b.senkning]) expect(Number.isFinite(v)).toBe(true);
        expect(b.senkning).toBeLessThanOrEqual(MAKS_SENKNING_M + 1e-9);
        const m = strommodell(id, b);
        for (let L = AVSTAND_MIN_M; L <= AVSTAND_MAKS_M; L += 30) {
          const t = reisetidMotBronn(L, m);
          expect(t).not.toBeNull();
          expect(t!).toBeGreaterThan(0);
          ingenFeiltall(fmtVarighet(t));
        }
        ingenFeiltall(fmtLs(b.Q));
        ingenFeiltall(fmtAvstand(avstandForReisetid(KRAV_OPPHOLDSTID_DOGN, m)));
      }
    }
  });
});

describe('Reisetid mot en brønn som pumper', () => {
  it('uten pumping er reisetiden L/v', () => {
    const m = strommodell('sand', bronnstatus('sand', 0));
    const v = strom('sand')!.v;
    expect(reisetidMotBronn(60, m)!).toBeCloseTo((60 - BRONN_RADIUS_M) / v / SEK_PER_DOGN, 6);
    expect(reisetidMotBronn(0, m)).toBe(0);
  });

  it('stemmer med den analytiske løsningen for sand med 5 l/s', () => {
    const b = bronnstatus('sand', 5)!;
    const m = strommodell('sand', b);
    const a = m.K * m.i;
    const c = m.Q / (2 * Math.PI * TYKKELSE_M);
    const L = 60;
    const rb = BRONN_RADIUS_M;
    // ∫ nₑ r dr / (a r + c) = nₑ/a · [(L − rb) − (c/a) · ln((aL + c)/(a rb + c))]
    const analytisk = ((m.ne / a) * (L - rb - (c / a) * Math.log((a * L + c) / (a * rb + c)))) / SEK_PER_DOGN;
    expect(reisetidMotBronn(L, m)!).toBeCloseTo(analytisk, 3);
    // Standardvalget (sand, 5 l/s, 60 m) holder kravet, med 10 l/s gjør det ikke
    expect(analytisk).toBeGreaterThan(KRAV_OPPHOLDSTID_DOGN);
    expect(reisetidMotBronn(L, strommodell('sand', bronnstatus('sand', 10)))!).toBeLessThan(KRAV_OPPHOLDSTID_DOGN);
  });

  it('mer pumping gir kortere reisetid', () => {
    let forrige = Infinity;
    for (const q of [0, 1, 5, 10, 20]) {
      const t = reisetidMotBronn(60, strommodell('sand', bronnstatus('sand', q)))!;
      expect(t).toBeLessThan(forrige);
      forrige = t;
    }
  });

  it('ingen gradient og ingen pumping gir null', () => {
    const m = { ...strommodell('sand', bronnstatus('sand', 0)), i: 0 };
    expect(reisetidMotBronn(60, m)).toBeNull();
    expect(porefartVed(m, 30)).toBe(0);
    // Gradient 0 men pumping: vannet kommer fram innenfor påvirkningsradien
    const p = { ...strommodell('sand', bronnstatus('sand', 5)), i: 0 };
    expect(reisetidMotBronn(60, p)).not.toBeNull();
    expect(reisetidMotBronn(Number.NaN, p)).toBeNull();
  });

  it('60-døgnsgrensen: grus langt unna, sand noen titalls meter', () => {
    const grus = avstandForReisetid(KRAV_OPPHOLDSTID_DOGN, strommodell('grus', bronnstatus('grus', 5)))!;
    expect(grus).toBeGreaterThan(500);
    const sandM = strommodell('sand', bronnstatus('sand', 5));
    const sand = avstandForReisetid(KRAV_OPPHOLDSTID_DOGN, sandM)!;
    expect(sand).toBeGreaterThan(20);
    expect(sand).toBeLessThan(80);
    expect(reisetidMotBronn(sand, sandM)!).toBeCloseTo(KRAV_OPPHOLDSTID_DOGN, 3);
    expect(avstandForReisetid(0, sandM)).toBe(BRONN_RADIUS_M);
    expect(avstandForReisetid(-1, sandM)).toBeNull();
    expect(avstandForReisetid(KRAV_OPPHOLDSTID_DOGN, { ...sandM, i: 0, Q: 0 })).toBeNull();
    expect(tekst(fmtAvstand(1043))).toBe('1,0 km');
    expect(fmtAvstand(60)).toBe('60 m');
  });

  it('merkene flytter seg mot brønnen og kommer fram etter reisetiden', () => {
    const m = strommodell('sand', bronnstatus('sand', 5));
    const tab = reiseTabell(60, m)!;
    const total = reisetidMotBronn(60, m)!;
    expect(tab.t[tab.t.length - 1]!).toBeCloseTo(total, 2);
    expect(avstandEtter(tab, 0)).toBeCloseTo(60, 6);
    expect(avstandEtter(tab, total + 1)).toBe(BRONN_RADIUS_M);
    let forrige = Infinity;
    for (let a = 0; a <= total; a += total / 20) {
      const r = avstandEtter(tab, a);
      expect(r).toBeLessThanOrEqual(forrige);
      forrige = r;
    }
    // Halvveis i tid er merket mer enn halvveis i avstand (farten øker inn mot brønnen)
    expect(avstandEtter(tab, total / 2)).toBeGreaterThan(30);
    expect(avstandEtter(tab, Number.NaN)).toBeCloseTo(60, 6);
    expect(reiseTabell(60, { ...m, i: 0, Q: 0 })).toBeNull();
  });
});

describe('Tekst', () => {
  it('varigheter, farter og pumperater', () => {
    expect(fmtVarighet(1.16)).toBe('1,2 døgn');
    expect(fmtVarighet(88.4)).toBe('88 døgn');
    expect(fmtVarighet(3 * 365.25)).toBe('3,0 år');
    expect(tekst(fmtVarighet(7649 * 365.25))).toBe('7 600 år');
    expect(fmtFart(0)).toBe('0 m/døgn');
    expect(fmtFart(null)).toBe('–');
    expect(fmtLs(0.005)).toBe('5 l/s');
    expect(fmtLs(0.0195)).toBe('19,5 l/s');
    expect(fmtLs(0.00025)).toBe('0,25 l/s');
    expect(fmtLs(0)).toBe('0 l/s');
  });
});
