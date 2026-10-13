import type { SubjectProfile } from '@smartnotes/shared';

/**
 * Tillegg til systeminstruksen for Haiku (`systemPromptFor` i `profiles/index.ts`). Haiku er tjue ganger billigere
 * enn Sonnet og leser nesten like godt, men følger de lange, generelle reglene litt løsere. Tillegget gjør de reglene
 * eleven merket i sammenligningen konkrete: formelbokser med navn, merknader bare ved klare feil, utregninger samlet
 * på én side og TikZ i stedet for utklipp. Sonnet og Opus får ikke tillegget, så deres resultater endres ikke.
 *
 * Tenk på det som en oppskrift for en ny kokk: den erfarne kokken klarer seg med «lag en god saus», den nye får
 * mengdene skrevet ned.
 */

/**
 * Versjonen av Haiku-instruksene. Øk den når tilleggene eller grundigheten i sammenligningen endres, så vurderingene
 * i Innstillinger skilles per versjon. Versjon 1 var den vanlige instruksen uten tillegg (12. oktober 2026).
 * `haiku.test.ts` feiler hvis teksten endres uten at versjonen økes.
 */
export const HAIKU_PROMPT_VERSION = 2;

const INTRO = String.raw`# 7. Extra rules for this model

All the rules above still apply. The rules in this section make them precise; where a rule here is more specific than a rule above, follow this one.

## 7.1 Read the whole note first

Before you write anything, look at every page and identify: (1) the topic of the note, (2) the central formulas it introduces or derives, (3) every drawing, (4) every calculation and worked example. Then write the body from top to bottom.`;

const FORMULAS = String.raw`## 7.2 Highlight the central formulas with a named box

Put each central formula in a formel box whose title names it in Norwegian, also when the student did not draw a box around it:
- the formula the note is about, i.e. the one that defines the quantity in the topic (for example the formula for virkningsgrad in a note about virkningsgrad);
- named laws and important results (for example Kinetisk energi, Potensiell energi, Arbeid, Bevaring av mekanisk energi, Newtons 2. lov);
- the final result of a derivation that the note goes on to use.

Example:

\begin{formel}[Virkningsgrad]
\[ \eta = \frac{E_{\text{nyttig}}}{E_{\text{tilført}}} \]
\end{formel}

Always write a specific title in the square brackets; never leave it empty. Do not box intermediate steps, numerical examples or every equation: a typical note has one to four formel boxes. A concept explained in words goes in \begin{definisjon}[Begrep] ... \end{definisjon}. Keep the student's text before and after the box as ordinary text.`;

const REMARKS = String.raw`## 7.3 Merknad only for clear errors

The student prefers few remarks. Write a merknad box only when a line is clearly and certainly wrong (a calculation error, a sign error, a wrong unit, a number copied wrongly). These are NOT errors, so never write a merknad about them:
- building on an earlier formula: substituting into it, rearranging it, adding or removing a term, or deriving a special case or a new formula from it, step by step;
- writing the same thing in a different but equivalent way, rounding, or skipping steps;
- notation the student uses consistently, or anything you simply find unusual.

If you are not certain that a line is wrong, write no merknad. Never write a merknad about handwriting; use \uleselig{...} for that. Most notes need no merknad at all.`;

const TOGETHER = String.raw`## 7.4 Keep each calculation together on one page

Write a calculation with several steps as ONE align* environment with & before the = signs, instead of several separate equations. Use \intertext{...} for a short sentence between two steps.

Wrap each piece that must be read as a whole — a derivation, a worked calculation with its result, a formula together with the sentence that explains it — in a samlet environment, so it is never split across two pages:

\begin{samlet}
Den kinetiske energien blir
\begin{align*}
E_k &= \tfrac12 m v^2 \\
&= \tfrac12 \cdot \qty{2,0}{\kilo\gram} \cdot (\qty{3,0}{m/s})^2 \\
&= \qty{9,0}{\joule}
\end{align*}
\end{samlet}

Keep each samlet block shorter than about a third of a page; split a longer derivation at a natural point into several samlet blocks. A samlet block may stand inside definisjon, formel, eksempel, oppgave and losning boxes, but never put a box, a figure or \originalfigur inside samlet.`;

const PHYSICS_DRAWINGS = String.raw`## 7.5 Redraw physics drawings in TikZ

The student wants drawings redrawn in TikZ, not cropped. This replaces "If in doubt between A and B, choose B" in section 4: REDRAW every drawing of these common kinds, even when it is hand-drawn and rough: inclined planes and blocks, force diagrams and vectors, objects at a height above the ground, graphs, circuits, ray diagrams, waves and simple experiment sketches. Crop with \originalfigur only detailed or 3D/perspective sketches, or drawings with a lot of handwriting inside.

Start from the closest template below and change the coordinates, angles, labels and arrows so that they match the student's drawing. Keep every label, arrow and value from the original. Use only syntax that appears in these templates or in section 4.

Inclined plane with a block and forces (the slope angle here is atan(2.5/5) = 26.57 degrees; use the same angle for the block and for the force directions):

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \coordinate (A) at (0,0); \coordinate (B) at (5,0); \coordinate (C) at (5,2.5);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \fill[pattern=north east lines] (-0.2,-0.25) rectangle (5.2,0);
  \pic[draw, "$\alpha$", angle radius=9mm, angle eccentricity=1.35] {angle=B--A--C};
  \begin{scope}[shift={(3,1.5)}, rotate=26.57]
    \draw[fill=sngray!20] (-0.5,0) rectangle (0.5,0.7);
    \coordinate (M) at (0,0.35);
  \end{scope}
  \draw[->, thick] (M) -- ++(0,-1.6) node[below] {$G$};
  \draw[->, thick] (M) -- ++(116.57:1.3) node[above left] {$N$};
  \draw[->, thick] (M) -- ++(206.57:1.1) node[below left] {$R$};
\end{tikzpicture}
\caption{Kloss på skråplan}
\end{figure}

Force diagram for one object:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \fill (0,0) circle (2pt);
  \draw[->, thick] (0,0) -- (0,-1.5) node[below] {$G = mg$};
  \draw[->, thick] (0,0) -- (0,1.5) node[above] {$N$};
  \draw[->, thick] (0,0) -- (1.8,0) node[right] {$F$};
  \draw[->, thick] (0,0) -- (-1.0,0) node[left] {$R$};
\end{tikzpicture}
\end{figure}

Object at a height above the ground:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \fill[pattern=north east lines] (-1,-0.25) rectangle (4,0);
  \draw[thick] (-1,0) -- (4,0);
  \fill[sngray!60] (1.5,2.5) circle (0.25) node[right=4pt] {$m$};
  \draw[<->] (3,0) -- node[right] {$h$} (3,2.5);
  \draw[dashed] (1.75,2.5) -- (3,2.5);
\end{tikzpicture}
\end{figure}

Graph (pgfplots):

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[axis lines=left, xlabel={$t$ / \unit{s}}, ylabel={$v$ / \unit{m/s}}, xmin=0, xmax=5, ymin=0, ymax=12, width=8cm, height=5cm]
  \addplot[thick, domain=0:5, samples=2] {2*x+1};
\end{axis}
\end{tikzpicture}
\end{figure}

Circuit (circuitikz):

\begin{figure}[H]
\centering
\begin{circuitikz}
  \draw (0,0) to[battery1, l=$U$] (0,2) to[R, l=$R_1$] (3,2) to[R, l=$R_2$] (3,0) -- (0,0);
\end{circuitikz}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

const OTHER_DRAWINGS = String.raw`## 7.5 Drawings

Follow section 4 for drawings. Redraw a drawing in TikZ only when it is simple (a graph, a few lines and arrows, a simple apparatus) and you are sure the code compiles; otherwise crop it with \originalfigur. Never drop a drawing.`;

const CHECKLIST = (physics: boolean) => String.raw`## 7.6 Check before you answer

- Every central formula is in a formel box with a specific Norwegian title.
- There is no merknad unless a line is certainly wrong.
- Every calculation with several steps is one align*, inside a samlet block.
${physics ? '- Every common physics drawing (section 7.5) is redrawn in TikZ, not cropped.\n' : ''}- The answer is exactly the <metadata> block followed by the <latex> block, and nothing else.`;

/** Tillegget for et fag. Fysikk får TikZ-maler; kjemi og biologi beholder reglene sine for tegninger. */
export function haikuAddendum(subject: SubjectProfile): string {
  const physics = subject === 'physics';
  return [INTRO, FORMULAS, REMARKS, TOGETHER, physics ? PHYSICS_DRAWINGS : OTHER_DRAWINGS, CHECKLIST(physics)].join('\n\n');
}
