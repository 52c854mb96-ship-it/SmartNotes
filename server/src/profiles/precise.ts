import type { SubjectProfile } from '@smartnotes/shared';

/**
 * De presise reglene: seksjon 7 i systeminstruksen for alle Claude-modeller (`systemPromptFor` i `profiles/index.ts`).
 * De gjør de lange, generelle reglene konkrete der eleven merket forskjeller i sammenligningen (formelbokser med navn,
 * merknader bare ved klare feil, `\uleselig` bare når sammenhengen ikke avgjør, utregninger samlet på én side, TikZ i
 * stedet for utklipp) og der analysen fant feller (bokstitler, prosenttegn, LaTeX i metadata). Reglene ble laget for
 * Haiku (versjon 2), og fra versjon 3 får Sonnet og Opus dem også (elevens valg 13. oktober 2026). Lokale modeller
 * (Ollama) får dem ikke: de har sin egen, kortere vei gjennom `ollama.ts`.
 *
 * Tenk på det som en oppskrift: den erfarne kokken klarer seg med «lag en god saus», men med mengdene skrevet ned
 * blir sausen lik hver gang, uansett hvem som lager den.
 */

/**
 * Versjonen av instruksene: grunninstruksen og rettingsinstruksen til hvert fag, de presise reglene (alle
 * Claude-modeller), avslutningene og oppsettet i sammenligningen (grundighet, svarlengde, rettingsrunder). Øk den når
 * noe av dette endres, så vurderingene i Innstillinger skilles per versjon. `precise.test.ts` feiler hvis teksten
 * endres uten at versjonen økes (fra versjon 5 er grunn- og rettingsinstruksen med i fingeravtrykket).
 * - 1 (12. oktober 2026): den vanlige instruksen uten tillegg.
 * - 2 (13. oktober): tillegget for Haiku.
 * - 3 (14. oktober): `\uleselig` bare når sammenhengen ikke avgjør, maler for kjemi og biologi, og reglene for alle
 *   Claude-modeller. En sammenligning vurderer fortsatt Haiku; den vanlige versjonen av notatet har reglene bare hvis
 *   den er konvertert etter at versjon 3 ble lagt ut.
 * - 4 (14. oktober): Geofag 1 (egne tegneregler og maler), og enheter i `\qty` og `\unit` uten æ, ø, å og °.
 * - 5 (14. oktober): kapittel og delkapittel etter hva notatet handler om, ikke etter et ord i tittelen (et notat om
 *   virkningsgraden til en kran havnet i termodynamikken), og `\uleselig` bare når modellen kan nevne en annen lesning.
 */
export const PROMPT_VERSION = 5;

const INTRO = String.raw`# 7. Precise rules

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

The student prefers few remarks. This replaces the merknad rules above: write a merknad box only when a line is certainly wrong (one of the errors section 1 lists, such as a calculation error, a sign error, a wrong unit or a number copied wrongly). These are NOT errors, so never write a merknad about them:
- building on an earlier formula: substituting into it, rearranging it, adding or removing a term, or deriving a special case or a new formula from it, step by step;
- writing the same thing in a different but equivalent way, rounding, or skipping steps;
- notation the student uses consistently, or anything you simply find unusual.

If you are not certain that a line is wrong, write no merknad. Most notes need no merknad at all.`;

const HANDWRITING = String.raw`## 7.4 Handwriting that is hard to read

Handwriting that is hard to read is never a merknad. This replaces "If a word, number or symbol is hard to read" in section 1:
1. First read it from its context: the words around it, the subject and the topic of the note, the task it belongs to, and the formula or calculation it belongs to. A word that is only partly legible is usually the word that makes sense in the sentence (for example "energi" after "kinetisk" in a note about energy), a heading or label next to a calculation is usually about what that calculation finds, in the student's own words, and a symbol or number is usually the one used in the lines before or after it.
2. If the context leaves one sensible reading, write it as ordinary text, with no marking and no remark. Reading a word from its context is not inventing content; adding a word that is not written is. Untidy, joined-up or slanted handwriting is no reason to mark a word.
3. Use \uleselig{...} only when two or more readings are still possible and they mean something different, for example a digit that could be 3 or 8, a sign that could be + or −, or a word that could be "øker" or "synker". Before you use it, name the other reading: write your best reading inside \uleselig and both readings in "remarks" (for example «3,5 m eller 8,5 m»). If you cannot name a second reading that also fits the sentence and the task and means something different, write your best reading as ordinary text instead. A second reading must also fit the letters you can see: a word that only fits the calculation better does not count. Never replace the student's word with a more precise term (if the letters read "kraft" but the calculation finds work, write "kraft"). \uleselig works both in text and inside formulas, e.g. $\uleselig{v_0}$. Put it around a whole quantity or chemical formula, never inside \qty, \num, \ang or \ce: \uleselig{\qty{9,81}{m/s^2}}, $\uleselig{\ce{SO4^2-}}$. Something that cannot be read at all is written \uleselig{[uleselig]}, as section 1 says; for a number with a unit, write \uleselig{[uleselig]}~\unit{kg} instead of \qty.`;

const TEXT = String.raw`## 7.5 Text, numbers and units

- In ordinary text, write \% for a percent sign (35 \%), \& for &, and \# for #. Anything with a subscript or superscript is math: $v_0$, $E_k$, $x^2$.
- Numbers always keep the student's decimal comma, also inside siunitx: \qty{9,81}{m/s^2}, \qty{2,5}{kg}, \num{6,67e-11}. Write units as plain strings like m, kg, s, N, J, W, km/h, m/s^2, kg.m/s^2. Use \degreeCelsius for °C, \percent for % and \ohm for Ω inside \qty. In TikZ and pgfplots code (coordinates, domains, expressions) use a decimal point. A label inside [...] options (TikZ "..." or circuitikz l=) goes in braces, so a decimal comma in it works: "{$26,6^\circ$}", l={$U = 4,5$ V}.
- A word in a subscript is text: $v_{\text{snitt}}$, $E_{\text{tilført}}$.
- A unit inside \qty or \unit has only plain letters a–z, digits and symbols such as / . ^ (m/s^2, kJ/mol): letters like æ, ø and å and the sign ° are lost there. Write a Norwegian word after the quantity, outside it: \qty{2,5}{cm} per år, \num{5730}~år, \qty{1200}{m} o.h. Write degrees as \degreeCelsius, never °.`;

const TOGETHER = String.raw`## 7.6 Keep each calculation together

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

Use samlet for each calculation or derivation, not around whole sections. If the student wrote a sentence that introduces the calculation, put it inside the samlet block as its first line; never add a sentence that is not in the notes. Do not start a samlet block with a figure, list or box. It may stand inside the boxes.`;

const FIGURES = String.raw`Figures: always write \begin{figure}[H], with exactly [H]. A figure may stand inside a box (this replaces "never put a figure environment inside a box" in section 2). Never write \caption outside a figure environment.`;

const PHYSICS_DRAWINGS = String.raw`## 7.7 Redraw physics drawings in TikZ

The student wants drawings redrawn in TikZ, not cropped. This replaces "If in doubt between A and B, choose B" in section 4: REDRAW every drawing of these common kinds, even when it is hand-drawn and rough: inclined planes and blocks, force diagrams and vectors, objects at a height above the ground, graphs, circuits, ray diagrams, waves and simple experiment sketches. Crop with \originalfigur only detailed or 3D/perspective sketches, or drawings with a lot of handwriting inside.

${FIGURES}

Start from the closest template below and change the coordinates, labels and arrows so that they match the student's drawing. Keep every label, arrow and value from the original. Use only syntax that appears in these templates or in section 4.

Inclined plane with a block and forces. This slope rises to the right, with angle a (here a = 26.57, from a height of 2.5 over a length of 5): rotate the block by a, draw G straight down and N at the angle a+90 (perpendicular to the slope, away from it). Friction R points along the slope against the motion: at the angle a (up the slope, as here) when the block slides down or stands still, and at a+180 when it moves up. Draw only the forces the student drew. If the angle label is longer than one symbol (for example "{$26,6^\circ$}"), write angle eccentricity=2 instead of 1.35. If the student's slope rises to the LEFT, use the second template:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \coordinate (A) at (0,0); \coordinate (B) at (5,0); \coordinate (C) at (5,2.5);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \fill[pattern=north east lines] (-0.2,-0.25) rectangle (5.2,0);
  \pic[draw, "{$\alpha$}", angle radius=9mm, angle eccentricity=1.35] {angle=B--A--C};
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
  \pic[draw, "{$\alpha$}", angle radius=9mm, angle eccentricity=1.35] {angle=C--A--B};
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

Keep samples=100 for every function. Change the expression and domain to match the student's graph, and set xmin, xmax, ymin and ymax from the numbers on the student's axes so that the whole curve and every point fit. If the student's axis crosses zero inside the graph (ymin negative and ymax positive, as in a v-t graph for a vertical throw), write axis lines=middle, xlabel style={at={(ticklabel* cs:1)}, anchor=west}, ylabel style={at={(ticklabel* cs:1)}, anchor=south} instead of axis lines=left, so the time axis runs through 0 and the labels stay clear of the curve. For measured points write \addplot[only marks] coordinates {(0,1) (1,3) (2,5)}; with the student's values (decimal point inside the plot code).

Circuit (circuitikz):

\begin{figure}[H]
\centering
\begin{circuitikz}
  \draw (0,0) to[battery1, l={$U$}] (0,2) to[R, l={$R_1$}] (3,2) to[R, l={$R_2$}] (3,0) -- (0,0);
\end{circuitikz}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

const CHEMISTRY_DRAWINGS = String.raw`## 7.7 Redraw chemistry drawings

Formulas, ions and reaction equations are never drawings: always write them with \ce, as section 3 says. Redraw these common drawings, even when they are rough: structural formulas and simple Lewis structures (chemfig), energy diagrams, and titration curves and other graphs. Crop with \originalfigur sketches of experiments and lab equipment, 3D molecule drawings, large molecules you are not sure about, and drawings with a lot of handwriting inside. If in doubt, crop.

${FIGURES}

Start from the closest template below and change the formulas, labels, values and coordinates so that they match the student's notes. Keep every label, arrow and value from the original. Use only syntax that appears in these templates or in sections 3 and 4.

Reaction equation with states and reaction enthalpy, and an equilibrium:

\[ \ce{CH4(g) + 2 O2(g) -> CO2(g) + 2 H2O(l)} \qquad \Delta H = \qty{-890}{kJ/mol} \]

\[ \ce{N2(g) + 3 H2(g) <=> 2 NH3(g)} \]

Structural formula on its own line (here ethanol). Bonds: - single, = double, ~ triple; [2] points up, [6] down, [4] left, and a branch goes in parentheses:

\begin{center}
\chemfig{H-C(-[2]H)(-[6]H)-C(-[2]H)(-[6]H)-O-H}
\end{center}

Energy diagram for a reaction. Here it is exothermic: the reactants lie at height 3, the top of the curve at 4.5 and the products at 1.5. Change the three heights to match the student's drawing (for an endothermic reaction the products lie higher than the reactants, and \Delta H points up), and keep the control points at the same heights as the points next to them:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \draw[->] (0,0) -- (0,5) node[above] {Energi};
  \draw[->] (0,0) -- (8.6,0) node[below left] {Reaksjonsforløp};
  \draw[thick] (0.3,3) -- (2,3) .. controls (3,3) and (3,4.5) .. (4,4.5) .. controls (5,4.5) and (5,1.5) .. (6,1.5) -- (8.2,1.5);
  \node[above] at (1.1,3) {Reaktanter};
  \node[below] at (6.6,1.5) {Produkter};
  \draw[dashed] (2,3) -- (7.9,3);
  \draw[<->] (4,3) -- (4,4.5) node[midway, left] {$E_a$};
  \draw[->] (7.9,3) -- (7.9,1.5) node[midway, right] {$\Delta H$};
\end{tikzpicture}
\end{figure}

A titration curve or another graph is a pgfplots axis with the student's measured points:

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[axis lines=left, xlabel={$V$ / \unit{mL}}, ylabel={pH}, xmin=0, xmax=30, ymin=0, ymax=14, width=8cm, height=5cm]
  \addplot[thick, mark=*] coordinates {(0,1.0) (10,1.5) (20,2.5) (24,4.0) (25,7.0) (26,10.0) (30,11.5)};
\end{axis}
\end{tikzpicture}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

const BIOLOGY_DRAWINGS = String.raw`## 7.7 Drawings in biology

Crop drawings of living things and their parts with \originalfigur, as section 4 says: cells, organelles, organs, anatomy, plants and microscope sketches, and anything detailed or with a lot of handwriting inside. Redraw these common schematics, even when they are rough: crossing schemes, simple flow diagrams, cycles and food chains with labelled boxes and arrows, and graphs. If in doubt, crop.

${FIGURES}

Start from the closest template below and change the labels so that they match the student's notes. Keep every label and arrow from the original, and add or remove boxes and arrows to match. Use only syntax that appears in these templates or in section 4.

Crossing scheme as a table. When the student drew it as a grid, it uses | and \hline instead of the booktabs rules, as section 3 says: the gametes of one parent go along the top, and those of the other parent down the left side:

\begin{center}
\begin{tabular}{c|cc}
 & $A$ & $a$ \\ \hline
$A$ & $AA$ & $Aa$ \\
$a$ & $Aa$ & $aa$
\end{tabular}
\end{center}

Flow diagram or food chain: boxes in a row with arrows between them. Write a line break inside a box as \\:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}, boks/.style={draw, rounded corners, align=center, inner sep=5pt}]
  \node[boks] (a) {Lys};
  \node[boks, right=1cm of a] (b) {Fotosyntese};
  \node[boks, right=1cm of b] (c) {Glukose\\og oksygen};
  \draw[->, thick] (a) -- (b);
  \draw[->, thick] (b) -- (c);
\end{tikzpicture}
\end{figure}

Cycle: the boxes around a circle, with an arrow from each box to the next, and a label on an arrow where the student wrote one:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}, boks/.style={draw, rounded corners, align=center, inner sep=5pt}]
  \node[boks] (a) at (90:2) {Karbondioksid\\i lufta};
  \node[boks] (b) at (0:3.5) {Planter};
  \node[boks] (c) at (270:2) {Dyr};
  \node[boks] (d) at (180:3.5) {Nedbrytere};
  \draw[->, thick] (a) to[bend left=20] node[above right] {fotosyntese} (b);
  \draw[->, thick] (b) to[bend left=20] (c);
  \draw[->, thick] (c) to[bend left=20] (d);
  \draw[->, thick] (d) to[bend left=20] node[above left] {respirasjon} (a);
\end{tikzpicture}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

/** Et eksempel per fag på et ord som hører til flere kapitler, så modellen velger kapittel etter innholdet. */
const CHAPTER_EXAMPLE: Record<SubjectProfile, string> = {
  physics:
    'For example, virkningsgrad for an electric motor, crane, lift or person that lifts a load, and for a hydroelectric power plant where water falls a height (W = mgh, P = W/t), belongs to the chapter about work and energy, while virkningsgrad for a heat engine (a petrol or diesel engine, or a thermal power plant that burns fuel) and the varmefaktor of a heat pump belong to the chapter about heat and thermodynamics.',
  chemistry:
    'For example, a note that finds ΔH for burning methane from bond enthalpies belongs to the chapter about energy in chemical reactions, while a note about how alkanes react and are named belongs to the chapter about organic compounds.',
  biology:
    'For example, diffusion and osmosis across a cell membrane belong to the chapter about cells and cell membranes, while transport of oxygen in the blood belongs to the chapter about the human body, and transport of water in a plant to the chapter about animals and plants.',
  geoscience:
    'For example, erosion and deposition that shape a valley or a delta belong to the chapter about landforms and landscape processes, while a landslide or flood that threatens people belongs to the chapter about natural hazards.',
};

/**
 * Hva «hva notatet handler om» betyr i hvert fag. Grunninstruksen har én felles ordlyd, fordi svarformatet (seksjon 6)
 * skal være likt i alle fag (`profiles.test.ts`).
 */
const CHAPTER_FOCUS: Record<SubjectProfile, string> = {
  physics: 'its situation, quantities and formulas',
  chemistry: 'the substances, reactions and calculations it works with',
  biology: 'the processes, structures and organisms it explains',
  geoscience: 'the processes, landforms, places and data it describes',
};

const METADATA = (subject: SubjectProfile) => String.raw`## 7.8 Metadata

All strings in the JSON are plain text: no LaTeX, no backslashes, no dollar signs and no straight double quotes inside a string (use «» for quotes). Write symbols in plain letters or words, for example "v0", "Ek", "delta v", "alfa".

"chapter" and "section": choose them from what the note is about (${CHAPTER_FOCUS[subject]}), not from a single word in the note title that also appears in a chapter or section title. The same word can belong to several chapters. ${CHAPTER_EXAMPLE[subject]}`;

const EXAMPLE = String.raw`## 7.9 Example answer

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
Omtrent 20 \% av energien går tapt som varme. Ballen kastes fra høyden \uleselig{\qty{3,5}{m}}.
\originalfigur[0.5]{fig1}{Skisse av kastet}
</latex>
<metadata>
{"title": "Kinetisk energi", "chapter": "k3", "section": "3.2", "new_chapter": null, "date": "2026-10-13", "figures": [{"id": "fig1", "page": 2, "box": [120, 1150, 1500, 2050]}], "remarks": ["Høyden på side 1 kan være 3,5 m eller 8,5 m."]}
</metadata>

In "box", x counts from the left edge of the page image and y from the top edge: [x0, y0, x1, y1] is the top-left and bottom-right corner of the drawing in pixels, including its labels and a small margin.`;

const GEOSCIENCE_DRAWINGS = String.raw`## 7.7 Drawings in geoscience

Crop with \originalfigur, as section 4 says: maps, block diagrams and other perspective sketches of plate boundaries, volcanoes, glaciers and landscapes, detailed geological cross-sections, photographs and printed figures. Redraw these common schematics, even when they are rough: climate diagrams, simple terrain profiles, simple layered rock sequences, the rock cycle and other cycles and flow diagrams, and graphs. If in doubt, crop.

${FIGURES}

Start from the closest template below and change the labels, values and coordinates so that they match the student's notes. Keep every label, arrow and value from the original. Use only syntax that appears in these templates or in section 4.

Climate diagram: precipitation as bars against the right axis and temperature as a curve against the left axis, one value per month (decimal point inside the plot code). Use the student's values and axis ranges. The bars are grey and the curve black; use blue bars and a red curve only if the student coloured them so:

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[width=10cm, height=6cm, axis y line*=right, axis x line=none, ymin=0, ymax=200, ylabel={Nedbør / \unit{mm}}, xmin=0.5, xmax=12.5]
  \addplot[ybar, bar width=10pt, fill=sngray!25, draw=sngray] coordinates {(1,80) (2,60) (3,55) (4,45) (5,50) (6,65) (7,80) (8,95) (9,110) (10,120) (11,105) (12,90)};
\end{axis}
\begin{axis}[width=10cm, height=6cm, axis y line*=left, axis x line*=bottom, ymin=-10, ymax=20, ylabel={Temperatur / \unit{\degreeCelsius}}, xmin=0.5, xmax=12.5, xtick={1,...,12}, xticklabels={J,F,M,A,M,J,J,A,S,O,N,D}]
  \addplot[thick, mark=*] coordinates {(1,-4.3) (2,-4.0) (3,-0.2) (4,4.5) (5,10.8) (6,15.2) (7,16.4) (8,15.2) (9,10.8) (10,6.3) (11,0.7) (12,-3.1)};
\end{axis}
\end{tikzpicture}
\end{figure}

Terrain profile: distance along the profile on the x axis and height above sea level on the y axis, with the student's points:

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[width=11cm, height=5cm, axis lines=left, xlabel={Avstand / \unit{km}}, ylabel={Høyde / \unit{m} o.h.}, xmin=0, xmax=10, ymin=0, ymax=1200]
  \addplot[thick, fill=sngray!15] coordinates {(0,0) (1,150) (2,420) (3,800) (4,1050) (5,900) (6,600) (7,640) (8,380) (9,120) (10,0)} \closedcycle;
\end{axis}
\end{tikzpicture}
\end{figure}

Layered rock sequence (oldest layer at the bottom), with one pattern per kind of rock. Each label stands to the right of its layer, at x = the column width + 0.2 and y = the middle of the layer:

\begin{figure}[H]
\centering
\begin{tikzpicture}
  \draw[pattern=dots] (0,0) rectangle (3,1);
  \node[right] at (3.2,0.5) {Sandstein};
  \draw[pattern=north east lines] (0,1) rectangle (3,1.8);
  \node[right] at (3.2,1.4) {Skifer};
  \draw[pattern=bricks] (0,1.8) rectangle (3,3);
  \node[right] at (3.2,2.4) {Kalkstein};
  \draw[->] (-0.4,0) -- (-0.4,3) node[midway, left] {yngre};
\end{tikzpicture}
\end{figure}

The rock cycle or another cycle: the boxes around a circle, with an arrow from each box to the next, and the process on the arrow where the student wrote one:

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}, boks/.style={draw, rounded corners, align=center, inner sep=5pt}]
  \node[boks] (a) at (90:2) {Magma};
  \node[boks] (b) at (0:3.5) {Magmatiske\\bergarter};
  \node[boks] (c) at (270:2) {Sedimentære\\bergarter};
  \node[boks] (d) at (180:3.5) {Metamorfe\\bergarter};
  \draw[->, thick] (a) to[bend left=20] node[above right] {størkning} (b);
  \draw[->, thick] (b) to[bend left=20] node[below right] {forvitring} (c);
  \draw[->, thick] (c) to[bend left=20] node[below left] {trykk og varme} (d);
  \draw[->, thick] (d) to[bend left=20] node[above left] {smelting} (a);
\end{tikzpicture}
\end{figure}

Use colour only where the student used colour (red, blue, sngreen, snorange, black).`;

const DRAWING_CHECK: Record<SubjectProfile, string> = {
  physics: '- Every common physics drawing (section 7.7) is redrawn in TikZ, not cropped.',
  chemistry: '- Every formula and reaction equation is written with \\ce, and every common chemistry drawing (section 7.7) is redrawn, not cropped.',
  biology: '- Crossing schemes and simple flow diagrams and cycles (section 7.7) are redrawn; drawings of living things are cropped.',
  geoscience: '- Climate diagrams, simple terrain profiles, layer sequences and cycles (section 7.7) are redrawn; maps, landscape sketches and photos are cropped.',
};

const CHECKLIST = (subject: SubjectProfile) => String.raw`## 7.10 Check before you answer

- The <latex> block comes first, then the <metadata> block, and nothing else.
- Every line of the note is included, in order; crossed-out text is left out.
- Every central formula is in a formel box with a specific Norwegian title.
- There is no merknad unless a line is certainly wrong.
- Words you could read from the context are written without \uleselig; it is used only where two readings are still possible, and "remarks" names both readings.
- Every calculation with several steps is one align*, inside a samlet block.
${DRAWING_CHECK[subject]}
- Percent signs in text are written \%, and numbers keep the decimal comma.
- "chapter" and "section" match what the note is about (${CHAPTER_FOCUS[subject]}), not a single word in its title.
- The JSON strings are plain text without LaTeX.`;

const DRAWINGS: Record<SubjectProfile, string> = {
  physics: PHYSICS_DRAWINGS,
  chemistry: CHEMISTRY_DRAWINGS,
  biology: BIOLOGY_DRAWINGS,
  geoscience: GEOSCIENCE_DRAWINGS,
};

/** De presise reglene for et fag. Hvert fag har sine maler for tegninger; resten er likt. */
export function preciseRules(subject: SubjectProfile): string {
  return [INTRO, BOXES, REMARKS, HANDWRITING, TEXT, TOGETHER, DRAWINGS[subject], METADATA(subject), EXAMPLE, CHECKLIST(subject)].join('\n\n');
}

/** Siste linje i brukermeldingen til Sonnet og Opus, rett etter sidebildene (rekkefølgen som i seksjon 7.1). */
export const CLOSING = 'Konverter notatet. Svar med <latex> og <metadata> som beskrevet.';

/**
 * Siste linje i brukermeldingen til Haiku, rett etter sidebildene: det modellen leser sist før den skriver, veier mest,
 * så Haiku får de viktigste reglene gjentatt. Sonnet og Opus får `CLOSING`.
 */
export const HAIKU_CLOSING = String.raw`Konverter notatet. Skriv <latex> først og <metadata> etterpå (seksjon 7). Husk: hver linje med, i riktig rekkefølge; navngitte formel-bokser for de sentrale formlene; merknad bare ved sikre feil; les utydelige ord ut fra sammenhengen og oppgaven, og bruk \uleselig bare når to lesninger fortsatt er mulige (skriv begge i remarks); velg kapittel og delkapittel etter hva notatet handler om, ikke etter ett ord i tittelen; hver utregning i én align* inne i samlet; desimalkomma og \% i tekst; ren tekst i JSON.`;
