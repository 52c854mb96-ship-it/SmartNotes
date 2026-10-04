/**
 * Faste farger for fysiske størrelser, slik at samme kraft har samme farge i alle visualiseringene.
 * Verdiene er CSS-variabler (styles/viz.css) og fungerer i både lyst og mørkt tema.
 */
export const VIZ = {
  gravity: 'var(--viz-gravity)',
  normal: 'var(--viz-normal)',
  friction: 'var(--viz-friction)',
  applied: 'var(--viz-applied)',
  tension: 'var(--viz-tension)',
  velocity: 'var(--viz-velocity)',
  acceleration: 'var(--viz-accel)',
  /** Generelle dataserier i grafer, i fast rekkefølge. */
  series: ['var(--viz-s1)', 'var(--viz-s2)', 'var(--viz-s3)', 'var(--viz-s4)', 'var(--viz-s5)'],
  /** Tekst, akser og hjelpelinjer. */
  ink: 'var(--viz-ink)',
  muted: 'var(--viz-muted)',
  grid: 'var(--viz-grid)',
  surface: 'var(--viz-surface)',
  body: 'var(--viz-body)',
  bodyStrong: 'var(--viz-body-strong)',
} as const;
