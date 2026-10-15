import { describe, expect, it } from 'vitest';
import {
  fmtAlder,
  fraDognet,
  GEO_HENDELSER,
  GEOLOGISK_TID,
  intervallVed,
  intervaller,
  JORDAS_ALDER,
  periodeVed,
  PREKAMBRIUM,
  tidsintervall,
  tilDognet,
  type TidsNiva,
} from './geotid';

const NBSP = / /g;
const tekst = (s: string) => s.replace(NBSP, ' ');

describe('tidsskalaen', () => {
  it('har grensene fra ICS-kartet 2023/09', () => {
    expect(tidsintervall('devon')?.start).toBe(419.62);
    expect(tidsintervall('devon')?.slutt).toBe(358.86);
    expect(tidsintervall('karbon')?.start).toBe(358.86);
    expect(tidsintervall('karbon')?.usikkerhet).toBe(0.19);
    expect(tidsintervall('silur')?.slutt).toBe(419.62);
    expect(tidsintervall('kambrium')?.start).toBe(538.8);
    expect(tidsintervall('ordovicium')?.start).toBe(486.85);
    expect(tidsintervall('trias')?.start).toBe(251.902);
    expect(tidsintervall('kritt')?.start).toBe(143.1);
    expect(tidsintervall('kritt')?.omtrent).toBe(true);
    expect(tidsintervall('paleogen')?.start).toBe(66);
    expect(tidsintervall('kvartaer')?.start).toBe(2.58);
    expect(tidsintervall('holocen')?.start).toBe(0.0117);
    expect(tidsintervall('hadeikum')?.start).toBe(JORDAS_ALDER);
    expect(tidsintervall('finnes-ikke')).toBeNull();
  });

  it('hvert nivå er sammenhengende fra eldst til yngst, uten hull eller overlapp', () => {
    for (const niva of ['eon', 'era', 'periode', 'epoke'] as TidsNiva[]) {
      const liste = intervaller(niva);
      expect(liste.length).toBeGreaterThan(0);
      for (const i of liste) expect(i.start).toBeGreaterThan(i.slutt);
      for (let k = 1; k < liste.length; k++) expect(liste[k]!.start).toBe(liste[k - 1]!.slutt);
      expect(liste.at(-1)!.slutt).toBe(0);
    }
    expect(intervaller('eon')[0]!.start).toBe(JORDAS_ALDER);
    // Prekambrium dekker alt før fanerozoikum, men står utenfor tabellen
    expect(PREKAMBRIUM.slutt).toBe(tidsintervall('fanerozoikum')!.start);
    expect(GEOLOGISK_TID.some((i) => i.id === 'prekambrium')).toBe(false);
  });

  it('hvert intervall ligger inne i forelderen sin', () => {
    for (const i of GEOLOGISK_TID) {
      if (!i.forelder) continue;
      const f = tidsintervall(i.forelder);
      expect(f, i.id).not.toBeNull();
      expect(i.start).toBeLessThanOrEqual(f!.start);
      expect(i.slutt).toBeGreaterThanOrEqual(f!.slutt);
    }
  });

  it('har unike nøkler og etiketter med stor forbokstav', () => {
    const ids = GEOLOGISK_TID.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of GEOLOGISK_TID) {
      expect(i.etikett.charAt(0)).toBe(i.etikett.charAt(0).toUpperCase());
      expect(i.navn).toBe(i.navn.toLowerCase());
      // Kortnavnene skal ikke se ut som enheten for millioner år eller gi «NaN» i teksten
      expect(i.kort).not.toMatch(/^(Ma|Na)$/);
    }
  });
});

describe('oppslag', () => {
  it('finner perioden', () => {
    expect(periodeVed(150)?.id).toBe('jura');
    expect(periodeVed(400)?.id).toBe('devon');
    expect(periodeVed(0)?.id).toBe('kvartaer');
    expect(periodeVed(1)?.id).toBe('kvartaer');
    expect(periodeVed(600)?.id).toBe('ediacara');
  });

  it('en alder på grensen hører til det yngre intervallet', () => {
    expect(periodeVed(66)?.id).toBe('paleogen');
    expect(periodeVed(66.0001)?.id).toBe('kritt');
    expect(periodeVed(419.62)?.id).toBe('devon');
    expect(intervallVed(0.0117, 'epoke')?.id).toBe('holocen');
  });

  it('faller tilbake til era eller eon der det ikke finnes perioder', () => {
    expect(periodeVed(3000)?.id).toBe('mesoarkeikum');
    expect(periodeVed(4300)?.id).toBe('hadeikum');
    expect(intervallVed(3000, 'periode')).toBeNull();
    expect(intervallVed(200, 'epoke')).toBeNull();
  });

  it('gir null for ugyldige aldre', () => {
    expect(periodeVed(-1)).toBeNull();
    expect(periodeVed(5000)).toBeNull();
    expect(periodeVed(Number.NaN)).toBeNull();
    expect(periodeVed(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('hendelser', () => {
  it('ligger innenfor jordas historie og har gyldige spenn', () => {
    for (const h of GEO_HENDELSER) {
      expect(h.alder).toBeGreaterThan(0);
      expect(h.alder).toBeLessThanOrEqual(JORDAS_ALDER);
      if (h.slutt !== undefined) expect(h.slutt).toBeLessThan(h.alder);
      expect(h.tekst).not.toMatch(/\bMa\b/);
    }
    // Sortert fra eldst til yngst
    for (let k = 1; k < GEO_HENDELSER.length; k++) expect(GEO_HENDELSER[k]!.alder).toBeLessThan(GEO_HENDELSER[k - 1]!.alder);
  });

  it('masseutdøingene ligger på periodegrensene', () => {
    const perm = GEO_HENDELSER.find((h) => h.tekst.includes('perm'))!;
    expect(perm.alder).toBe(tidsintervall('trias')!.start);
    const kritt = GEO_HENDELSER.find((h) => h.tekst.includes('dinosaurene'))!;
    expect(kritt.alder).toBe(tidsintervall('paleogen')!.start);
  });
});

describe('jordas historie som ett døgn', () => {
  it('jorda dannes ved midnatt og i dag er kl. 24', () => {
    expect(tilDognet(JORDAS_ALDER)?.klokke).toBe('kl. 00.00.00');
    expect(tilDognet(0)?.klokke).toBe('kl. 24.00.00');
    expect(tilDognet(0)?.forMidnatt).toBe(0);
    expect(tilDognet(JORDAS_ALDER / 2)?.klokkeKort).toBe('kl. 12.00');
  });

  it('kambrium begynner om kvelden og mennesker kommer de siste sekundene', () => {
    const kambrium = tilDognet(538.8)!;
    expect(kambrium.timer).toBe(21);
    expect(kambrium.minutter).toBe(10);
    const mennesker = tilDognet(0.3)!;
    expect(mennesker.forMidnatt).toBeGreaterThanOrEqual(5);
    expect(mennesker.forMidnatt).toBeLessThanOrEqual(7);
  });

  it('fraDognet er det motsatte', () => {
    const d = tilDognet(1000)!;
    expect(fraDognet(d.sekunder)).toBeCloseTo(1000, -1);
    expect(fraDognet(0)).toBe(JORDAS_ALDER);
    expect(fraDognet(86_400)).toBe(0);
  });

  it('gir null utenfor døgnet', () => {
    expect(tilDognet(-1)).toBeNull();
    expect(tilDognet(5000)).toBeNull();
    expect(tilDognet(Number.NaN)).toBeNull();
    expect(tilDognet(10, 0)).toBeNull();
    expect(fraDognet(-1)).toBeNull();
    expect(fraDognet(90_000)).toBeNull();
  });
});

describe('fmtAlder', () => {
  it('skriver millioner og milliarder år, aldri forkortelsen', () => {
    expect(fmtAlder(66)).toBe('66 millioner år');
    expect(fmtAlder(2.58)).toBe('2,58 millioner år');
    expect(fmtAlder(419.62)).toBe('420 millioner år');
    expect(fmtAlder(419.62, { desimaler: 2 })).toBe('419,62 millioner år');
    expect(fmtAlder(4567)).toBe('4,57 milliarder år');
    expect(fmtAlder(2500)).toBe('2,5 milliarder år');
    for (const a of [0, 0.0005, 0.0117, 0.3, 1, 2.58, 66, 538.8, 1000, 4567]) {
      expect(fmtAlder(a)).not.toMatch(/Ma\b/);
      expect(fmtAlder(a, { siden: true })).not.toMatch(/Ma\b/);
    }
  });

  it('entall for én', () => {
    expect(fmtAlder(1)).toBe('1 million år');
    expect(fmtAlder(1000)).toBe('1 milliard år');
  });

  it('under en million år skrives i år med mellomrom som tusenskille', () => {
    expect(tekst(fmtAlder(0.0117))).toBe('11 700 år');
    expect(tekst(fmtAlder(0.3))).toBe('300 000 år');
    expect(tekst(fmtAlder(0.0108, { siden: true }))).toBe('10 800 år siden');
    expect(tekst(fmtAlder(0.012345))).toBe('12 300 år');
  });

  it('kort form, «siden» og tvungen enhet', () => {
    expect(fmtAlder(66, { kort: true })).toBe('66 mill. år');
    expect(fmtAlder(4567, { kort: true })).toBe('4,57 mrd. år');
    expect(fmtAlder(66, { siden: true })).toBe('66 millioner år siden');
    expect(fmtAlder(0, { siden: true })).toBe('i dag');
    expect(tekst(fmtAlder(2500, { enhet: 'millioner' }))).toBe('2500 millioner år');
  });

  it('ugyldige tall gir en strek', () => {
    expect(fmtAlder(Number.NaN)).toBe('–');
    expect(fmtAlder(-5)).toBe('–');
    expect(fmtAlder(Number.POSITIVE_INFINITY)).toBe('–');
  });
});

describe('fmtAlder: enheten etter avrundingen og tusenskille', () => {
  const tekst = (t: string) => t.replace(/[\u00a0\u202f]/g, ' ');
  it('bytter enhet når avrundingen når neste enhet', () => {
    expect(fmtAlder(999.9)).toBe('1 milliard år');
    expect(fmtAlder(999.4)).toBe('999 millioner år');
    expect(fmtAlder(0.9999999)).toBe('1 million år');
    expect(tekst(fmtAlder(0.9994))).toBe('999 000 år');
    expect(fmtAlder(999.9, { enhet: 'millioner' })).toBe('1000 millioner år');
  });
  it('skriver tusenskille først fra fem sifre, som fmtTall', () => {
    expect(fmtAlder(0.0035)).toBe('3500 år');
    expect(tekst(fmtAlder(0.0108))).toBe('10 800 år');
  });
});

