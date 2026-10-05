import { Fragment, type ReactNode } from 'react';
import { renderTex, useKatex } from './katex';
import { paragraphs, parseInline } from './richtext';

/** Tekst med **fet** og $formler$ (se richtext.ts). */
export function RichText({ text }: { text: string }) {
  const { katex } = useKatex();
  const parts = parseInline(text);
  return (
    <>
      {parts.map((p, i) => {
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
