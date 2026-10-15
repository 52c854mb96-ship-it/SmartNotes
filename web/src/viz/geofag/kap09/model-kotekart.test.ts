import { describe, expect, it } from 'vitest';
import { flytvei, helning, hoydefelt, hoydeVed, koter, terrengprofil, vannskille, type Hoydefelt } from '../kit/kart';
import {
  FORSKYVNING_MAKS,
  FORSKYVNING_STEG,
  FORVALG,
  KANTMARG,
  KART,
  RETNING_MAKS,
  RETNING_STEG,
  STEDER,
  brattklasse,
  elveLop,
  elvekryssinger,
  fmtAvstand,
  helningLangsLinja,
  hoyestePunkt,
  iInnsjo,
  innsjo,
  kompassretning,
  kotavstand,
  kotekrysninger,
  landskap,
  linjeGjennom,
  nedborfeltAreal,
  papirLengde,
  profilFor,
  profillinje,
  projiserPaaLinje,
  punktPaaLinje,
  vannIProfil,
  vistVinkel,
} from './model-kotekart';

/** Et skråplan som stiger 10 m per 100 m mot øst (helning 0,1, ca. 5,7°). */
function skraplan(): Hoydefelt {
  return hoydefelt(1, [{ type: 'plan', z0: 100, helningX: 0.1, helningY: 0 }], { bredde: 1000, lengde: 800, celle: 20 })!;
}

/** En kjegle med rette sider: 300 m høy og 600 m i radius midt i et 1600 × 1600 m felt. */
function kjegle(): Hoydefelt {
  return hoydefelt(1, [{ type: 'kjegle', x: 800, y: 800, hoyde: 300, radius: 600 }], { bredde: 1600, lengde: 1600, celle: 10 })!;
}

describe('kart.ts brukt på enkle former', () => {
  it('skråplanet gir riktig helning i grader og prosent, og retningen nedover er vest', () => {
    const felt = skraplan();
    for (const [x, y] of [
      [100, 100],
      [500, 400],
      [870, 730],
    ] as const) {
      const h = helning(felt, x, y)!;
      expect(h.prosent).toBeCloseTo(10, 6);
      expect(h.grader).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 6);
      expect(h.retning).toBeCloseTo(270, 6);
    }
  });

  it('kotene på skråplanet er rette, parallelle linjer med lik avstand (ekvidistanse / helning)', () => {
    const felt = skraplan();
    const k = koter(felt, 10);
    expect(k.length).toBeGreaterThan(5);
    const xs: number[] = [];
    for (const kote of k) {
      // Hver kote er én rett linje x = (h − 100) / 0,1 fra nord til sør
      expect(kote.linjer).toHaveLength(1);
      const forventet = (kote.hoyde - 100) / 0.1;
      for (const [x] of kote.linjer[0]!.punkter) expect(x).toBeCloseTo(forventet, 6);
      xs.push(kote.linjer[0]!.punkter[0]![0]);
    }
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(100, 6);
  });

  it('kotene rundt en kjegle er sirkler med radius som avtar jevnt med høyden', () => {
    const felt = kjegle();
    for (const kote of koter(felt, 50)) {
      if (kote.hoyde <= 0 || kote.hoyde >= 300) continue;
      expect(kote.linjer).toHaveLength(1);
      expect(kote.linjer[0]!.lukket).toBe(true);
      const R = 600 * (1 - kote.hoyde / 300);
      for (const [x, y] of kote.linjer[0]!.punkter) expect(Math.abs(Math.hypot(x - 800, y - 800) - R)).toBeLessThan(5);
    }
  });

  it('profilet starter og slutter i høyden til A og B', () => {
    const felt = landskap();
    for (const v of FORVALG) {
      const linje = profillinje(v.retning, v.forskyvning)!;
      const prof = terrengprofil(felt, linje.A, linje.B, 200);
      expect(prof[0]!.z).toBeCloseTo(hoydeVed(felt, linje.A[0], linje.A[1])!, 6);
      expect(prof[prof.length - 1]!.z).toBeCloseTo(hoydeVed(felt, linje.B[0], linje.B[1])!, 6);
      expect(prof[prof.length - 1]!.s).toBeCloseTo(linje.lengde, 6);
    }
  });

  it('alle punktene i nedbørfeltet renner til utløpet', () => {
    const felt = landskap();
    const nf = vannskille(felt, STEDER.utlop.p)!;
    expect(nf).not.toBeNull();
    const ut = `${nf.utlop[0]},${nf.utlop[1]}`;
    let sjekket = 0;
    for (let k = 0; k < nf.maske.length; k += 37) {
      if (!nf.maske[k]) continue;
      const i = k % felt.nx;
      const j = (k - i) / felt.nx;
      const vei = flytvei(felt, [i * felt.celle, j * felt.celle]);
      expect(vei.some(([x, y]) => `${x},${y}` === ut)).toBe(true);
      sjekket++;
    }
    expect(sjekket).toBeGreaterThan(100);
    // Og et punkt utenfor feltet renner et annet sted
    const utenfor = nf.maske.findIndex((m) => !m);
    const i = utenfor % felt.nx;
    const vei = flytvei(felt, [i * felt.celle, ((utenfor - i) / felt.nx) * felt.celle]);
    expect(vei.some(([x, y]) => `${x},${y}` === ut)).toBe(false);
  });

  it('ekvidistanse 0, negativ eller ugyldig gir ingen koter, ingen krysninger og ingen kotavstand (og ingen evig løkke)', () => {
    const felt = landskap();
    const prof = profilFor(felt, profillinje(FORVALG[0]!.retning, FORVALG[0]!.forskyvning)!);
    for (const e of [0, -20, NaN, Infinity]) {
      expect(koter(felt, e)).toEqual([]);
      expect(kotekrysninger(prof, e)).toEqual([]);
      expect(kotavstand(felt, 1300, 1000, e)).toBeNull();
    }
    // En svært liten ekvidistanse gir heller ikke en evig løkke
    expect(koter(felt, 1e-6)).toEqual([]);
  });
});

describe('landskapet', () => {
  const felt = landskap();
  const sjo = innsjo(felt, STEDER.vann.punkt, STEDER.vann.niva);

  it('er et tenkt norsk landskap: Storhøgda er det høyeste punktet, og dalbunnen ligger lavest', () => {
    const topp = hoyestePunkt(felt, STEDER.topp.p, 250);
    expect(hoydeVed(felt, topp[0], topp[1])).toBeCloseTo(felt.max, 6);
    expect(felt.max).toBeGreaterThan(550);
    expect(felt.max).toBeLessThan(650);
    expect(felt.min).toBeGreaterThan(80);
    expect(felt.min).toBeLessThan(150);
    // Åsene er lavere enn toppen
    for (const a of [STEDER.aasNord.p, STEDER.aasSor.p]) {
      const p = hoyestePunkt(felt, a, 250);
      expect(hoydeVed(felt, p[0], p[1])!).toBeLessThan(felt.max - 100);
    }
  });

  it('Langvatnet renner ikke over: vannstanden er den som er satt, og vannet når ikke kartkanten', () => {
    expect(sjo).not.toBeNull();
    expect(sjo!.niva).toBe(STEDER.vann.niva);
    expect(sjo!.antall).toBeGreaterThan(200);
    for (let k = 0; k < sjo!.maske.length; k++) {
      if (!sjo!.maske[k]) continue;
      const i = k % felt.nx;
      const j = (k - i) / felt.nx;
      expect(i > 0 && j > 0 && i < felt.nx - 1 && j < felt.ny - 1).toBe(true);
      expect(felt.z[k]!).toBeLessThan(STEDER.vann.niva);
    }
    // Med for høy vannstand senkes den til terskelen, som i Kotekart
    const hoy = innsjo(felt, STEDER.vann.punkt, 400)!;
    expect(hoy.niva).toBeLessThan(STEDER.vann.niva + 5);
    expect(innsjo(felt, STEDER.vann.punkt, 50)).toBeNull();
  });

  it('Dalelva renner fra nordkanten gjennom Langvatnet og ut av kartet i sør, og Fossbekken ender i vannet', () => {
    const [elv, bekk, side] = elveLop(felt, sjo);
    expect(elv!.punkter.some(([x, y]) => iInnsjo(felt, sjo, x, y))).toBe(true);
    expect(elv!.punkter[elv!.punkter.length - 1]![1]).toBe(KART.lengde);
    // Elva renner nedover (groper fylt): aldri mer enn litt oppover
    const z = elv!.punkter.map(([x, y]) => hoydeVed(felt, x, y)!);
    for (let i = 1; i < z.length; i++) expect(z[i]!).toBeLessThan(z[i - 1]! + 15);
    const sist = bekk!.punkter[bekk!.punkter.length - 1]!;
    expect(iInnsjo(felt, sjo, sist[0], sist[1])).toBe(true);
    expect(side!.punkter.length).toBeGreaterThan(10);
  });

  it('nedbørfeltet til Dalelva er en del av kartet (omtrent 6 km² av 11,2 km²)', () => {
    const a = nedborfeltAreal(felt)!;
    expect(a).toBeGreaterThan(4);
    expect(a).toBeLessThan(9);
  });
});

describe('profillinja', () => {
  it('går fra kant til kant innenfor kantmargen for alle verdiene på glidebryterne, og er minst 1,5 km', () => {
    for (let r = 0; r <= RETNING_MAKS; r += RETNING_STEG) {
      for (let f = -FORSKYVNING_MAKS; f <= FORSKYVNING_MAKS; f += FORSKYVNING_STEG) {
        const l = profillinje(r, f);
        expect(l, `retning ${r}, forskyvning ${f}`).not.toBeNull();
        expect(l!.lengde).toBeGreaterThan(1500);
        for (const [x, y] of [l!.A, l!.B]) {
          expect(x).toBeGreaterThanOrEqual(KANTMARG - 1e-6);
          expect(x).toBeLessThanOrEqual(KART.bredde - KANTMARG + 1e-6);
          expect(y).toBeGreaterThanOrEqual(KANTMARG - 1e-6);
          expect(y).toBeLessThanOrEqual(KART.lengde - KANTMARG + 1e-6);
        }
      }
    }
  });

  it('retningen er kompassretningen fra A mot B, og forskyvningen går til høyre sett fra A', () => {
    const ost = profillinje(90, 0)!;
    expect(ost.B[0]).toBeGreaterThan(ost.A[0]);
    expect(ost.A[1]).toBeCloseTo(KART.lengde / 2, 6);
    // Mot øst er høyre sør (større y)
    expect(profillinje(90, 300)!.A[1]).toBeCloseTo(KART.lengde / 2 + 300, 6);
    const nord = profillinje(0, 300)!;
    expect(nord.B[1]).toBeLessThan(nord.A[1]);
    expect(nord.A[0]).toBeCloseTo(KART.bredde / 2 + 300, 6);
    expect(profillinje(NaN, 0)).toBeNull();
    expect(profillinje(0, 5000)).toBeNull();
  });

  it('punktet på linja og projeksjonen tilbake gir samme andel', () => {
    const l = profillinje(110, -150)!;
    for (const t of [0, 0.13, 0.5, 0.87, 1]) expect(projiserPaaLinje(l, punktPaaLinje(l, t))).toBeCloseTo(t, 9);
    expect(projiserPaaLinje(l, [-5000, -5000])).toBeGreaterThanOrEqual(0);
    expect(projiserPaaLinje(l, [NaN, 0])).toBe(0);
    expect(punktPaaLinje(l, 7)).toEqual(l.B);
  });

  it('forhåndsvalgene ligger på glidebryternes steg og går gjennom stedene de er laget for', () => {
    for (const v of FORVALG) {
      expect(Number.isInteger(v.retning / RETNING_STEG)).toBe(true);
      expect(Number.isInteger(v.forskyvning / FORSKYVNING_STEG)).toBe(true);
      expect(Math.abs(v.forskyvning)).toBeLessThanOrEqual(FORSKYVNING_MAKS);
      expect(profillinje(v.retning, v.forskyvning)).not.toBeNull();
    }
    // «Over dalen» går nær toppen og nær vannet
    const l = profillinje(FORVALG[0]!.retning, FORVALG[0]!.forskyvning)!;
    const avstand = (p: readonly [number, number]) => {
      const q = punktPaaLinje(l, projiserPaaLinje(l, p));
      return Math.hypot(q[0] - p[0], q[1] - p[1]);
    };
    expect(avstand(STEDER.topp.p)).toBeLessThan(120);
    expect(avstand(STEDER.vann.punkt)).toBeLessThan(120);
    expect(linjeGjennom([0, 0], [100, 0]).retning).toBe(90);
    expect(linjeGjennom([0, 100], [0, 0]).retning).toBe(0);
  });
});

describe('langs profilet', () => {
  it('kotekrysningene på et skråplan kommer med lik avstand, og hver femte er tellekote', () => {
    const felt = skraplan();
    const prof = terrengprofil(felt, [0, 400], [1000, 400], 401);
    const k = kotekrysninger(prof, 10);
    // Fra 100 til 200 m o.h.: kotene 100, 110 … 200 (A og B ligger på en kote), hver én gang
    expect(k.map((x) => x.hoyde)).toEqual([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
    for (let i = 1; i < k.length; i++) expect(k[i]!.s - k[i - 1]!.s).toBeCloseTo(100, 6);
    expect(k.filter((x) => x.tykk).map((x) => x.hoyde)).toEqual([100, 150, 200]);
    // Baklengs kommer de samme kotene i synkende rekkefølge
    const ned = kotekrysninger(terrengprofil(felt, [1000, 400], [0, 400], 401), 10);
    expect(ned.map((x) => x.hoyde)).toEqual([200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100]);
    // Tilfeldige profilpunkter som ikke treffer kotene: én krysning per kote likevel
    const ujevn = terrengprofil(felt, [3, 400], [997, 400], 137);
    expect(kotekrysninger(ujevn, 10).map((x) => x.hoyde)).toEqual([110, 120, 130, 140, 150, 160, 170, 180, 190]);
  });

  it('kotavstanden på et skråplan er ekvidistansen delt på helningen, og gir planets vinkel', () => {
    const felt = skraplan();
    const ka = kotavstand(felt, 455, 400, 20)!;
    expect(ka.d).toBeCloseTo(200, 0);
    expect(ka.under).toBe(140);
    expect(ka.over).toBe(160);
    expect(ka.grader).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 1);
    // Målelinja står vinkelrett på kotene (rett øst–vest)
    expect(ka.fra[1]).toBeCloseTo(400, 6);
    expect(ka.til[1]).toBeCloseTo(400, 6);
  });

  it('kotavstanden er null på en flate, på en topp der det ikke finnes noen kote over, og utenfor kartet', () => {
    const flat = hoydefelt(1, [{ type: 'plan', z0: 100, helningX: 0, helningY: 0 }], { bredde: 500, lengde: 500 })!;
    expect(kotavstand(flat, 250, 250, 10)).toBeNull();
    const k = kjegle();
    expect(kotavstand(k, 805, 800, 40)).toBeNull(); // 297,5 m o.h.: koten over (320) finnes ikke
    expect(kotavstand(k, -10, 800, 50)).toBeNull();
    // I lia på kjegla er avstanden 100 m (helning 0,5)
    expect(kotavstand(k, 800, 1000, 50)!.d).toBeCloseTo(100, 0);
  });

  it('helningen langs linja er + oppover mot B og − nedover', () => {
    const felt = skraplan();
    const linje = { A: [100, 400] as [number, number], B: [900, 400] as [number, number], lengde: 800 };
    expect(helningLangsLinja(felt, linje, 0.5)!).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 6);
    const motsatt = { A: linje.B, B: linje.A, lengde: 800 };
    expect(helningLangsLinja(felt, motsatt, 0.5)!).toBeCloseTo((-Math.atan(0.1) * 180) / Math.PI, 6);
    // På tvers av helningen er profilet flatt
    expect(helningLangsLinja(felt, { A: [500, 100], B: [500, 700], lengde: 600 }, 0.5)!).toBeCloseTo(0, 6);
  });

  it('overhøyden gjør skråninger brattere i profilet: tan(vist) = overhøyde · tan(ekte)', () => {
    expect(vistVinkel(20, 1)).toBeCloseTo(20, 9);
    expect(vistVinkel(20, 3)).toBeCloseTo(47.5, 1);
    expect(vistVinkel(-10, 5)).toBeCloseTo(-41.4, 1);
    expect(vistVinkel(0, 10)).toBe(0);
    expect(vistVinkel(90, 2)).toBeNull();
    expect(vistVinkel(20, 0)).toBeNull();
    expect(vistVinkel(NaN, 2)).toBeNull();
  });

  it('profilet over dalen går gjennom Langvatnet og krysser Dalelva, og profilet over bekken krysser Fossbekken', () => {
    const felt = landskap();
    const sjo = innsjo(felt, STEDER.vann.punkt, STEDER.vann.niva);
    const elveLopene = elveLop(felt, sjo);
    const l = profillinje(FORVALG[0]!.retning, FORVALG[0]!.forskyvning)!;
    const vann = vannIProfil(felt, sjo, profilFor(felt, l));
    expect(vann.length).toBe(1);
    expect(vann[0]![1] - vann[0]![0]).toBeGreaterThan(150);
    const elver = elvekryssinger(l, elveLopene);
    expect(elver.map((e) => e.navn)).toContain(STEDER.elv.navn);
    for (let i = 1; i < elver.length; i++) expect(elver[i]!.s).toBeGreaterThan(elver[i - 1]!.s);
    const bekk = FORVALG.find((v) => v.id === 'over-bekken')!;
    const lb = profillinje(bekk.retning, bekk.forskyvning)!;
    expect(elvekryssinger(lb, elveLopene).map((e) => e.navn)).toEqual([STEDER.bekk.navn]);
    expect(vannIProfil(felt, sjo, profilFor(felt, lb))).toEqual([]);
  });
});

describe('tekst', () => {
  it('kompassretning, avstand, målestokk og bratthet på norsk', () => {
    expect(kompassretning(0)).toBe('nord');
    expect(kompassretning(100)).toBe('øst');
    expect(kompassretning(140)).toBe('sørøst');
    expect(kompassretning(355)).toBe('nord');
    expect(kompassretning(-90)).toBe('vest');
    expect(kompassretning(NaN)).toBe('–');
    expect(fmtAvstand(450)).toBe('450 m');
    expect(fmtAvstand(3788)).toBe('3,79 km');
    expect(fmtAvstand(null)).toBe('–');
    expect(papirLengde(3800)).toBeCloseTo(15.2, 9);
    expect(papirLengde(NaN)).toBeNull();
    expect(brattklasse(1)).toBe('flatt');
    expect(brattklasse(7)).toBe('slakt');
    expect(brattklasse(15)).toBe('middels');
    expect(brattklasse(25)).toBe('bratt');
    expect(brattklasse(35)).toBe('skredterreng');
    expect(brattklasse(null)).toBeNull();
    expect(brattklasse(NaN)).toBeNull();
  });
});
