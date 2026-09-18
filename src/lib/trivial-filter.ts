// Trivial / Opinion / Filler phrases that do not make verifiable factual claims
const FILLER_PHRASES = [
  /^however,?$/i,
  /^furthermore,?$/i,
  /^moreover,?$/i,
  /^in summary,?$/i,
  /^in conclusion,?$/i,
  /^overall,?$/i,
  /^overall,?\s+performance was (solid|strong|good|weak)\.?$/i,
  /^to summarize,?$/i,
  /^to conclude,?$/i,
  /^on the other hand,?$/i,
  /^additionally,?$/i,
  /^that being said,?$/i,
  /^in addition,?$/i,
  /^firstly,?$/i,
  /^secondly,?$/i,
  /^finally,?$/i,
  /^as noted above,?$/i,
  /^here is a summary( of the [a-z0-9 ]+)?:\.?$/i,
  /^here are the key highlights( of the [a-z0-9 ]+)?:\.?$/i,
  /^below is the overview( of the [a-z0-9 ]+)?:\.?$/i,
  /^i hope this helps\.?$/i,
  /^let me know if you need anything else\.?$/i,
  /^let us take a closer look\.?$/i,
  /^this was a (very )?(strong|good|bad|solid|mixed) quarter\.?$/i,
  /^the company had a (very )?(strong|good|bad|solid|mixed) quarter\.?$/i,
  /^this is a (strong|good|bad|solid|promising) approach\.?$/i,
  /^the outlook remains (strong|positive|negative|uncertain)\.?$/i,
  /^performance was (strong|good|impressive|satisfactory)\.?$/i
];

/**
 * FR-6: Trivial-Claim Filtering
 * Determines if a sentence makes a checkable factual claim or is merely filler/opinion/transition.
 * Fallback principle: When uncertain, err toward checkable (false = not trivial).
 */
export function isTrivialClaim(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return true;

  // If sentence contains any number, digit, percentage, or currency, it has checkable factual content
  if (/\d/.test(trimmed) || /[\$\u20AC\u00A3\u00A5%]/.test(trimmed)) {
    return false;
  }

  // Exact or regex match for known conversational filler and generic opinion
  for (const pattern of FILLER_PHRASES) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  const lower = trimmed.toLowerCase();

  // Very short transitions without factual data (<= 3 words)
  const words = trimmed.split(/\s+/);
  if (words.length <= 3) {
    const commonShortTransitions = ['however', 'furthermore', 'moreover', 'therefore', 'in conclusion', 'overall', 'in summary', 'to conclude'];
    if (commonShortTransitions.some(t => lower.startsWith(t))) {
      return true;
    }
  }

  // Pure opinion patterns
  if (
    lower.startsWith('i believe') ||
    lower.startsWith('in my opinion') ||
    lower.startsWith('it seems that') ||
    lower.startsWith('it appears to be')
  ) {
    if (!/(revenue|profit|loss|margin|ebitda|assets|shares|debt|ceo|cfo|acquisition|merger)/i.test(lower)) {
      return true;
    }
  }

  // Specific reference demo phrase from PRD Section 18:
  // "The company had a strong quarter." -> filtered as opinion -> GREY
  if (/^(the company|it|business|management) had a (strong|great|weak|poor|tough) (quarter|year|month)\.?$/i.test(trimmed)) {
    return true;
  }

  // Default: Treat as checkable (FR-6 fallback requirement: false negatives are acceptable, false positives are not)
  return false;
}