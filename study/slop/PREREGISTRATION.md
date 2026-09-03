# Slop experiment: preregistration

Written 2026-09-02, **before any document was collected or labelled.** Locked.
Anything added after Gregg's labels are in goes in a section headed
"exploratory, added after unblinding", or it does not go in.

## The question

Wave 1 found that self-narration density and specificity flag the cannabis
newsletter hard, but that neither separates the model corpora from the human
corpora. The metrics may be measuring **prose quality** rather than
**authorship**.

Every corpus this project owns is labelled by authorship. That is the wrong
label for this question. This experiment collects the right one.

## Hypotheses

**H1 (primary).** Self-narration rate and specificity separate documents Gregg
labels *slop* from documents he labels *good*, at a bootstrap 95% CI on the
difference that excludes zero.

**H2 (control, and the one that matters).** Within the slop pile and within the
good pile, the same metrics do **not** separate human-authored from AI-authored
documents.

H2 is what makes the result worth anything. If the metrics separate on
authorship too, the experiment has just re-measured Wave 1 with extra steps and
H1 is an artifact of the piles being authorship-sorted.

**H3 (known negative, included as a sanity check).** Lexical density does not
separate on the slop label. It failed in Wave 1 and is included so that a run
where everything separates can be recognised as a bug rather than a triumph.

## Design

- **40 documents**, 20 labelled slop, 20 labelled good.
- **Authorship must be crossed with the label.** Each pile needs at least **6
  human-authored** and at least **6 AI-authored** documents. A pile of 20 AI
  slop against 20 human good tests nothing. This is the single requirement that
  can invalidate the whole experiment, and it is the hardest one to satisfy,
  because finding human-written slop takes deliberate looking.
- **500 to 2,000 words per document.** Wave 1 raw counts were confounded by
  length: corpus median is 446 words and the specimen is 924. Inside this band
  the corpus max for self-narration is 2 hits, 1.95 per 1,000.
- **Any genre**, but record it. If every slop document is a marketing newsletter
  and every good document is a technical post, the experiment measures genre.
- **Label before measure.** Gregg fills LABELS.tsv completely before
  `slop.mjs` is run even once. No metric value is visible at labelling time.

## Metrics, locked

Primary:
1. `sn_rate` — self-narration hits per 1,000 words, six forms, from
   `lib/substance-metrics.mjs`.
2. `specificity` — (numerals + proper nouns) per 1,000 words.

Secondary:
3. `claim_unbacked_share` — of sentences making an evidence claim, the share
   carrying no numeral, citation or proper noun. Underpowered in Wave 1;
   included to see whether a corpus that argues from evidence rescues it.
4. `person_drift` — a document predominantly in second person containing one or
   two first-person-plural pronouns and no more. Crude in Wave 1 (~20% of human
   documents fired it). Reported, not relied on.

Control:
5. `lexical_density` — expected null. See H3.

No metric is added to this list after unblinding. A metric invented once the
labels are visible is a metric fitted to the labels.

## Decision rules, set in advance

- **Ships as a rule** if H1 holds and H2 holds — separates on quality, not on
  authorship.
- **Does not ship, and is written up as a negative** if H1 holds but H2 also
  shows authorship separation. That result means the piles were sorted by
  authorship and we learned nothing new.
- **Does not ship** if H1 fails. Write it up anyway. The project's own standing
  argument is that a rule nobody measured is a rule that flags humans.
- **n is small.** 20 per pile supports a direction, not a decimal place. The
  published sentence, if there is one, says "direction" and not a threshold.

## Known limitation, stated up front

The cannabis specimen is an **easy case**: AI output with no editing pass.
Detecting unedited slop is worth something — it is a large and growing genre —
but a detector validated only on unedited output will fail on polished-but-empty
prose, which is the harder and more common problem.

Gregg should therefore include, inside the slop pile, some documents that are
**competently written and still empty**. Mark them in the `notes` column. If the
metrics catch only the lazy ones, that is the finding and it needs saying.

## What Gregg does

1. Drop 40 `.txt` files into `study/slop/docs/`, 500 to 2,000 words each.
2. Fill in every row of `study/slop/LABELS.tsv`.
3. Say the labels are locked.
4. Only then does anyone run `node study/slop.mjs`.

---

# Amendment 1 — 2026-09-02, before any label existed

Recorded before the packet was read and before a single row of SLOP-LABELS.tsv
was filled. Nothing here is fitted to a result, because no result exists yet.

**What changed, and why.**

1. **Gregg no longer sources the documents.** The original design asked him to
   find 40 files and record each one's authorship himself. That was the wrong
   job to hand him: it is hours of collection work, and it puts the authorship
   in front of him while he judges, which contaminates the label this whole
   experiment depends on. The packet is now drawn from the corpora we already
   have.

2. **The labelling is blind**, following the protocol already used in
   `study/reedit/2026-09-01`. Passages are inline in `SLOP-READ-THIS.txt`, in a
   seeded shuffle, with no filenames. `SLOP-KEY.tsv` holds the mapping and is
   not opened until labels are locked. This is a straight improvement on the
   original design and should have been there from the start.

3. **30 passages, not 40.** 22,082 words. Forty documents in the original band
   came to roughly 32,000 words of careful reading, which is enough friction to
   make the experiment not happen.

4. **Authorship is fixed at 15 human / 15 AI by construction**, so the H2
   requirement of at least 6 of each per pile is satisfiable — but only if
   Gregg's labels do not simply track authorship. If they do, the piles will
   come out 15/15 aligned and H2 will fail, which is itself the finding.

5. **Word band tightened to 500-1,300** for the sample. The prereg's 500-2,000
   band still defines what is comparable; this is a sampling choice inside it,
   made to keep the reading load survivable. Every metric in play is a rate, so
   length is normalised anyway.

6. **Pile-size rule relaxed to at least 10 per pile.** Gregg does not control
   the split — he labels, and the piles fall out. A 20/10 split is a usable
   result; a 28/2 split is not, and the guard will say so.

**What did not change:** the metric list, the hypotheses, the decision rules,
and the requirement that hard cases be flagged. Those are the parts that could
be fitted to a result, so they stay locked.

## What Gregg actually does

1. Open `study/slop/SLOP-READ-THIS.txt`. Read the note at the top, then the
   30 passages.
2. Fill in `study/slop/SLOP-LABELS.tsv` — one row per passage number:
   `label` (slop or good), `confidence` (high/medium/low), `notes`.
3. Do not open `SLOP-KEY.tsv`.
4. Say the labels are locked. Then, and only then, `node study/slop.mjs`.

The script refuses to print anything until every row is filled, and refuses to
print a verdict if the design constraints are not met.
