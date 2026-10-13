import type { SubjectProfile } from '@smartnotes/shared';

/**
 * Tillegg til systeminstruksen for Haiku (`systemPromptFor` i `profiles/index.ts`). Haiku er tjue ganger billigere
 * enn Sonnet og leser nesten like godt, men følger de lange, generelle reglene litt løsere. Tillegget gjør reglene
 * konkrete der eleven merket forskjeller i sammenligningen (formelbokser med navn, merknader bare ved klare feil,
 * utregninger samlet på én side, TikZ i stedet for utklipp) og der analysen fant feller (bokstitler, prosenttegn,
 * LaTeX i metadata). Sonnet og Opus får ikke tillegget, så deres resultater endres ikke.
 *
 * Tenk på det som en oppskrift for en ny kokk: den erfarne kokken klarer seg med «lag en god saus», den nye får
 * mengdene skrevet ned.
 */

/**
 * Versjonen av Haiku-instruksene. Øk den når tilleggene, avslutningen eller grundigheten i sammenligningen endres, så
 * vurderingene i Innstillinger skilles per versjon. Versjon 1 var den vanlige instruksen uten tillegg (12. oktober
 * 2026). `haiku.test.ts` feiler hvis teksten endres uten at versjonen økes.
 */
export const HAIKU_PROMPT_VERSION = 2;

const INTRO = String.raw`# 7. Extra rules for this model

All the rules above still apply. This section makes them precise, and where it says that it replaces a rule above, follow this section.

## 7.1 Work in this order

1. Look at every page first. Note the topic of the note, the central formulas, every drawing and every calculation.
2. Write the <latex> block, from the top of page 1 to the end of the last page.
3. Then write the <metadata> block, describing the body you just wrote (the figure ids you used, the remarks you made).

This replaces the order in section 6: write <latex> first and <metadata> after it.`;

const BOXES = String.raw`## 7.2 Boxes

Put each central formula in a formel box whose title names it in Norwegian, also when the student did not draw a box around it (this replaces "that the student boxed, highlighted, underlined or marked as important" in section 2):
- the formula the note is about, i.e. the one that defines the quantity in the topic (for example the formula for virkningsgrad in a note about virkningsgrad);
- named laws and important results (for example Kinetisk energi, Potensiell energi, Arbeid, Bevaring av mekanisk energi, Newtons 2. lov);
- the final result of a derivation that the note goes on to use.

Do not box intermediate steps, numerical examples or every equation: a typical note has one to four formel boxes.

Titles: SmartNotes prints the box name in front of the title, so write only the specific part.
- \begin{formel}[Virkningsgrad] gives the title "Virkningsgrad". Always give formel a title.
- \begin{definisjon}[Fart] gives "Definisjon: Fart".
- \begin{eksempel}[Kloss på skråplan] gives "Eksempel: Kloss på skråplan", and \begin{oppgave}[1.23] gives "Oppgave 1.23".
- husk, merknad and losning take no title: write \begin{husk} directly, and put a word like "NB!" as the first word inside the box.
- The solution box is spelled losning, without ø.`;

const REMARKS = String.raw`## 7.3 Merknad only for clear errors

The student prefers few remarks. This replaces the merknad rules above: write a merknad box only when a line is certainly wrong (a calculation error, a sign error, a wrong unit, a number copied wrongly). These are NOT errors, so never write a merknad about them:
- building on an earlier formula: substituting into it, rearranging it, adding or removing a term, or deriving a special case or a new formula from it, step by step;
- writing the same thing in a different but equivalent way, rounding, or skipping steps;
- notation the student uses consistently, or anything you simply find unusual.

If you are not certain that a line is wrong, write no merknad. Handwriting you cannot read for certain is never a merknad: write your best reading in \uleselig{...} (it works both in text and inside formulas, e.g. $\uleselig{v_0}$) and mention it in "remarks". Most notes need no merknad at all.`;

const TEXT = String.raw`## 7.4 Text, numbers and units

- In ordinary text, write \% for a percent sign (35 \%), \& for &, and \# for #. Anything with a subscript or superscript is math: $v_0$, $E_k$, $x^2$.
- Numbers always keep the student's decimal comma, also inside siunitx: \qty{9,81}{m/s^2}, \qty{2,5}{kg}, \num{6,67e-11}. Write units as plain strings like m, kg, s, N, J, W, km/h, m/s^2, kg.m/s^2. Use \degreeCelsius for °C, \percent for % and \ohm for Ω inside \qty.
- A word in a subscript is text: $v_{\text{snitt}}$, $E_{\text{tilført}}$.`;

const TOGETHER = String.raw`## 7.5 Keep each calculation together

Write a calculation with several steps as ONE align* environment with & before the = signs, instead of several separate equations. Use \intertext{...} for a short sentence between two steps.

Wrap each piece that must be read as a whole — a derivation, a worked calculation with its result, a formula together with the sentence that explains it — in a samlet environment. SmartNotes then keeps it on one page (a long one is split normally, so nothing is lost):

\begin{samlet}
Den kinetiske energien blir
\begin{align*}
E_k &= \tfrac12 m v^2 \\
&= \tfrac12 \cdot \qty{2,0}{kg} \cdot (\qty{3,0}{m/s})^2 \\
&= \qty{9,0}{J}
\end{align*}
\end{samlet}

Use samlet for each calculation or derivation, not around whole sections. It may stand inside the boxes.`;

const FIGURES = String.raw`Figures: always write \begin{figure}[H], with exactly [H]. A figure may stand inside a box (this replaces "never put a figure environment inside a box" in section 2). Never write \caption outside a figure environment.`;

const PHYSICS_DRAWINGS = String.raw`## 7.6 Redraw physics drawings in TikZ

The student wants drawings redrawn in TikZ, not cropped. This replaces "If in doubt between A and B, choose B" in section 4: REDRAW every drawing of these common kinds, even when it is hand-drawn and rough: inclined planes and blocks, force diagrams and vectors, objects at a height above the ground, graphs, circuits, ray diagrams, waves and simple experiment sketches. Crop with \originalfigur only detailed or 3D/perspective sketches, or drawings with a lot of handwriting inside.

${FIGURES}

Start from the closest template below and change the coordinates, labels and arrows so that they match the student's drawing. Keep every label, arrow and value from the original. Use only syntax that appears in these templates or in section 4.

Inclined plane with a block and forces. This slope rises to the right, with angle a (here a = 26.57, from a height of 2.5 over a length of 5): rotate the block by a, draw G straight down and N at the angle a+90 (perpendicular to the slope, away from it). Friction R points along the slope against the motion: at the angle a (up the slope, as here) when the block slides down or stands still, and at a+180 when it moves up. Draw only the forces the student drew. If the student's slope rises to the LEFT, use the second template:

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
  \draw[->, thick] (M) -- ++(0,-1.2) node[below] {$G$};
  \draw[->, thick] (M) -- ++(116.57:1.3) node[above left] {$N$};
  \draw[->, thick] (M) -- ++(26.57:1.2) node[above] {$R$};
\end{tikzpicture}
\caption{Kloss på skråplan}
\end{figure}

The same slope rising to the left: rotate the block by -a, draw N at the angle 90-a, R up the slope at 180-a (down the slope: -a), and list the angle points counter-clockwise (C--A--B):

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \coordinate (A) at (5,0); \coordinate (B) at (0,0); \coordinate (C) at (0,2.5);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \fill[pattern=north east lines] (-0.2,-0.25) rectangle (5.2,0);
  \pic[draw, "$\alpha$", angle radius=9mm, angle eccentricity=1.35] {angle=C--A--B};
  \begin{scope}[shift={(2,1.5)}, rotate=-26.57]
    \draw[fill=sngray!20] (-0.5,0) rectangle (0.5,0.7);
    \coordinate (M) at (0,0.35);
  \end{scope}
  \draw[->, thick] (M) -- ++(0,-1.2) node[below] {$G$};
  \draw[->, thick] (M) -- ++(63.43:1.3) node[above right] {$N$};
  \draw[->, thick] (M) -- ++(153.43:1.2) node[above] {$R$};
\end{tikzpicture}
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
  \fill[sngray!60] (1.5,2.5) circle (0.25);
  \node[left=6pt] at (1.5,2.5) {$m$};
  \draw[<->] (3,0) -- node[right] {$h$} (3,2.5);
  \draw[dashed] (1.75,2.5) -- (3,2.5);
\end{tikzpicture}
\end{figure}

Graph (pgfplots):

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[axis lines=left, xlabel={$t$ / \unit{s}}, ylabel={$v$ / \unit{m/s}}, xmin=0, xmax=5, ymin=0, ymax=12, width=8cm, height=5cm]
  \addplot[thick, domain=0:5, samples=100] {2*x+1};
\end{axis}
\end{tikzpicture}
\end{figure}

Keep samples=100 for every function and change domain and the expression to match the student's graph (for example {0.5*9.81*x^2}). For measured points write \addplot[only marks] coordinates {(0,1) (1,3) (2,5)}; with the student's values.

Circuit (circuitikz):

\begin{figure}[H]
\centering
\begin{circuitikz}
  \draw (0,0) to[battery1, l=$U$] (0,2) to[R, l=$R_1$] (3,2) to[R, l=$R_2$] (3,0) -- (0,0);
\end{circuitikz}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

const OTHER_DRAWINGS = String.raw`## 7.6 Drawings

Follow section 4 for drawings. Redraw a drawing in TikZ only when it is simple (a graph, a few lines and arrows, a simple apparatus) and you are sure the code compiles; otherwise crop it with \originalfigur. Never drop a drawing.

${FIGURES}`;

const METADATA = String.raw`## 7.7 Metadata

All strings in the JSON are plain text: no LaTeX, no backslashes, no dollar signs and no straight double quotes inside a string (use «» for quotes). Write symbols in plain letters or words, for example "v0", "Ek", "delta v", "alfa".`;

const EXAMPLE = String.raw`## 7.8 Example answer

This example only shows the format. Its content is invented; never copy it into a note.

<latex>
\section{Kinetisk energi}
En gjenstand som beveger seg, har kinetisk energi.
\begin{formel}[Kinetisk energi]
\[ E_k = \tfrac12 m v^2 \]
\end{formel}
\begin{eksempel}[Ball som kastes]
\begin{samlet}
En ball med masse \qty{0,50}{kg} har farten \qty{4,0}{m/s}:
\begin{align*}
E_k &= \tfrac12 \cdot \qty{0,50}{kg} \cdot (\qty{4,0}{m/s})^2 \\
&= \qty{4,0}{J}
\end{align*}
\end{samlet}
\end{eksempel}
Omtrent 20 \% av energien går tapt som varme. Startfarten er $\uleselig{v_0}$.
\originalfigur[0.5]{fig1}{Skisse av kastet}
</latex>
<metadata>
{"title": "Kinetisk energi", "chapter": "k3", "section": "3.1", "new_chapter": null, "date": "2026-10-13", "figures": [{"id": "fig1", "page": 2, "box": [120, 1150, 1500, 2050]}], "remarks": ["Indeksen i v0 på side 1 var vanskelig å lese."]}
</metadata>

In "box", x counts from the left edge of the page image and y from the top edge: [x0, y0, x1, y1] is the top-left and bottom-right corner of the drawing in pixels, including its labels and a small margin.`;

const CHECKLIST = (physics: boolean) => String.raw`## 7.9 Check before you answer

- The <latex> block comes first, then the <metadata> block, and nothing else.
- Every line of the note is included, in order; crossed-out text is left out.
- Every central formula is in a formel box with a specific Norwegian title.
- There is no merknad unless a line is certainly wrong.
- Every calculation with several steps is one align*, inside a samlet block.
${physics ? '- Every common physics drawing (section 7.6) is redrawn in TikZ, not cropped.\n' : ''}- Percent signs in text are written \%, and numbers keep the decimal comma.
- The JSON strings are plain text without LaTeX.`;

/** Tillegget for et fag. Fysikk får TikZ-maler; kjemi og biologi beholder reglene sine for tegninger. */
export function haikuAddendum(subject: SubjectProfile): string {
  const physics = subject === 'physics';
  return [
    INTRO,
    BOXES,
    REMARKS,
    TEXT,
    TOGETHER,
    physics ? PHYSICS_DRAWINGS : OTHER_DRAWINGS,
    METADATA,
    EXAMPLE,
    CHECKLIST(physics),
  ].join('\n\n');
}

/**
 * Siste linje i brukermeldingen til Haiku, rett etter sidebildene: det modellen leser sist før den skriver, veier mest.
 * Erstatter «Konverter notatet. Svar med <metadata> og <latex> som beskrevet.» for de andre modellene.
 */
export const HAIKU_CLOSING = String.raw`Konverter notatet. Skriv <latex> først og <metadata> etterpå (seksjon 7). Husk: hver linje med, i riktig rekkefølge; navngitte formel-bokser for de sentrale formlene; merknad bare ved sikre feil; hver utregning i én align* inne i samlet; desimalkomma og \% i tekst; ren tekst i JSON.`;
