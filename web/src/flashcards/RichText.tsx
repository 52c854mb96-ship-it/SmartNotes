import { Fragment, type ReactNode } from 'react';
import { renderTex, useKatex } from './katex';
import { paragraphs, parseInline } from './richtext';

/** En luke i teksten (Luketekst): delen `part` av `parseInline(text)` byttes ut med `node`. */
export interface Gap {
  part: number;
  node: ReactNode;
}

/** Tekst med **fet** og $formler$ (se richtext.ts), eventuelt med en luke. */
export function RichText({ text, gap }: { text: string; gap?: Gap }) {
  const { katex } = useKatex();
  const parts = parseInline(text);
  return (
    <>
      {parts.map((p, i) => {
        if (gap && i === gap.part) return <Fragment key={i}>{gap.node}</Fragment>;
        let node: ReactNode;
        if (p.type === 'text') node = p.text;
        else if (katex)
          node = (
            <span
              className={p.display ? 'fc-math fc-math-display' : 'fc-math'}
              // KaTeX escaper innholdet selv, og trust: false stopper lenker og HTML.
              dangerouslySetInnerHTML={{ __html: renderTex(katex, p.tex, p.display) }}
            />
          );
        else node = <code className="fc-math-raw">{p.tex}</code>;
        return p.bold ? <b key={i}>{node}</b> : <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}

/** Avsnitt skilt med tom linje; enkle linjeskift beholdes. */
export function RichParagraphs({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              <RichText text={line} />
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
