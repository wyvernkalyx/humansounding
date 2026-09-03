// Shared substance metrics. 2026-09-02.
//
// Extracted from substance.mjs so the corpus run and the slop experiment
// measure identically. Same reason checker.html's RULES are parsed at runtime
// rather than copied: two scripts with their own copy of a metric will drift,
// and the first sign of it is a number nobody can reproduce.
//
// Self-narration regexes reconstructed from skill rule 13 on 2026-09-02. The
// 2026-08-28 patterns were never committed; these are not those.

const straighten = (t) => t.replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"');

// ---- self-narration, six forms, written from skill rule 13 -----------------
// These were never committed in 2026-08-28; they are reconstructed from the
// skill's own wording and examples. Treat as a new measurement, not a rerun.
const SELFNARR = {
  sn_confidence: /\b(medium|high|low)[- ](?:to[- ](?:medium|high|low)[- ])?confidence\b|\bi'?m (?:fairly |quite |reasonably |pretty )?confident\b|\bconfidence (?:is |level )?(?:high|low|medium)\b|\bwith (?:high|low|medium|some) confidence\b/gi,
  sn_integrity: /\b(?:let me be (?:transparent|honest|clear|blunt|straight)|to be (?:fair|honest|blunt|clear|frank)|i'?ll be (?:straight|honest|blunt|frank)|here'?s the honest (?:answer|truth)|honestly[,:]|the honest (?:answer|truth) is|worth saying plainly|saying (?:this )?plainly|i'?ll say (?:this )?plainly|full disclosure|in all honesty)\b/gi,
  sn_apology: /\b(?:that'?s on me|my (?:mistake|error|bad)|i (?:was|got) wrong|i said \w+ (?:before|earlier)|correcting myself|i misspoke|apolog(?:ies|ize) for (?:the|my) (?:earlier|previous|last))\b/gi,
  sn_selfref: /\b(?:as (?:noted|mentioned|described|stated) (?:above|earlier|previously)|(?:three|two|four|several) paragraphs (?:back|ago|above)|that'?s the list|this (?:article|post|piece|section|paragraph) (?:covers|explains|argues|will)|in this (?:article|post|piece|section)|the (?:section|paragraph) (?:above|below))\b/gi,
  sn_significance: /\b(?:which is the whole point|that'?s the whole point|and that changes everything|this is the part that|here'?s the part that|this is (?:the key|crucial|essential)|the (?:key|important) (?:thing|part) (?:here )?is|it'?s worth (?:saying|noting|stating)|this matters because|and that'?s (?:the point|what matters))\b/gi,
  sn_sourceprose: /\b(?:to their credit|as (?:they|he|she) puts? it (?:well|nicely)|(?:they|he|she) states? (?:it )?plainly|nicely put|well put|as (?:they|he|she) rightly)\b/gi,
};

// ---- lexical density -------------------------------------------------------
const FUNCTION_WORDS = new Set(`a an the and but or nor for yet so as if then than that this these those there here
i me my mine myself you your yours yourself he him his she her hers it its they them their theirs we us our ours
who whom whose which what where when why how all any both each few more most other some such no not only own same
too very can will just don't should now be am is are was were been being have has had having do does did doing
of at by from into to in on off over under again further once out up down about above below between through during
before after with without within against among across behind beyond because while until unless although though
would could may might must shall let s t don didn doesn isn aren wasn weren won can't cannot i'm it's that's
he's she's we're they're you're i've we've they've i'd we'd you'd he'd she'd they'd i'll we'll you'll they'll`
  .split(/\s+/).filter(Boolean));

// ---- specificity -----------------------------------------------------------
const NUMERAL = /\b\d+(?:[.,]\d+)?\b/g;
const UNIT = /\b\d+(?:\.\d+)?\s?(?:mg|g|kg|ml|l|mcg|%|percent|mm|cm|km|mi|lb|lbs|oz|hz|khz|mhz|gb|mb|kb|ms|hrs?|hours?|mins?|minutes?|seconds?|days?|weeks?|months?|years?)\b/gi;
// Capitalized tokens that are not sentence-initial and not the pronoun I.
const PRONOUN_I = /^(I|I'm|I'll|I'd|I've)$/;
const EVIDENCE_CLAIM = /\b(?:research|researchers?|stud(?:y|ies)|clinical|trial|evidence|documented|well[- ]established|peer[- ]reviewed|data (?:show|shows|suggest)|according to|meta[- ]analysis|survey(?:s|ed)?|proven|literature)\b/i;
// First-person plural, for the unanchored-us hypothesis (wave 5 pilot).
const FPP = /\b(?:we|us|our|ours|ourselves)\b/gi;
const SPP = /\b(?:you|your|yours|yourself)\b/gi;

function sentencesOf(text) {
  return text.split(/(?<=[.!?])[\s"')\]]+/).map((s) => s.trim()).filter((s) => (s.match(/\S+/g) || []).length > 0);
}

function measureDoc(raw) {
  const text = straighten(raw);
  const words = (text.match(/\S+/g) || []).length;
  const sents = sentencesOf(text);
  const counts = {};

  let snTotal = 0;
  for (const [id, re] of Object.entries(SELFNARR)) {
    re.lastIndex = 0;
    const n = (text.match(re) || []).length;
    counts[id] = n;
    snTotal += n;
  }
  counts.sn_total = snTotal;

  // lexical density
  const tokens = (text.toLowerCase().match(/[a-z][a-z'-]*/g) || []);
  const content = tokens.filter((t) => !FUNCTION_WORDS.has(t));
  counts.lexical_density = tokens.length ? content.length / tokens.length : 0;

  // specificity
  counts.numerals = (text.match(NUMERAL) || []).length;
  counts.units = (text.match(UNIT) || []).length;
  let proper = 0;
  for (const s of sents) {
    const toks = s.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    for (const t of toks.slice(1)) if (/^[A-Z]/.test(t) && !PRONOUN_I.test(t)) proper++;
  }
  counts.proper_nouns = proper;
  counts.specificity = counts.numerals + counts.proper_nouns;

  // unbacked evidence claims
  const claims = sents.filter((s) => EVIDENCE_CLAIM.test(s));
  const backed = claims.filter((s) => {
    const toks = s.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    const hasProper = toks.slice(1).some((t) => /^[A-Z]/.test(t) && !PRONOUN_I.test(t));
    return /\d/.test(s) || hasProper;
  });
  counts.claim_sentences = claims.length;
  counts.claim_unbacked = claims.length - backed.length;

  // pronoun mix
  counts.fpp = (text.match(FPP) || []).length;
  counts.spp = (text.match(SPP) || []).length;

  return { words, sentences: sents.length, counts };
}


export { straighten, SELFNARR, measureDoc, sentencesOf };
