/** Instruks for å lese en innholdsfortegnelse fra bilder. Felles for alle fag; `subject` er f.eks. «fysikk». */
export function tocPrompt(subject: string, example: { chapter: string; section: string }): string {
  return `Bildet/bildene viser innholdsfortegnelsen i en lærebok i ${subject}. Les av kapitlene og delkapitlene i rekkefølge:
- Kapitler (det øverste nivået, f.eks. «${example.chapter}»): nummer og tittel.
- Delkapitler (nivået rett under, f.eks. «${example.section}»): koden slik den står i boka og tittelen, under riktig kapittel.
Ta ikke med sidetall, dypere nivåer, oppgaver, sammendrag, forord, register, fasit eller vedlegg. Hvis boka ikke har nummererte kapitler, bruk null som nummer. Har et delkapittel ingen kode i boka, bruk kapittelnummeret, punktum og nummeret i rekkefølgen (f.eks. «2.3»). Har kapitlene ingen delkapitler, bruk en tom liste. Skriv titlene nøyaktig slik de står (riktig store/små bokstaver).`;
}
