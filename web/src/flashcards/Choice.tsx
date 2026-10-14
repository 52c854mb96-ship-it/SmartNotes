/** Et valg etter runden (repeter, neste økt, en annen form): en overskrift og en linje om hva det gjør. */
export function Choice({ label, meta, primary = false, onClick }: { label: string; meta: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`fc-repeat-btn${primary ? ' is-primary' : ''}`} onClick={onClick}>
      <span className="fc-repeat-label">{label}</span>
      <span className="fc-repeat-meta">{meta}</span>
    </button>
  );
}
