# Perceived axis: preregistration

Written 2026-09-07, **before any collection code exists and before a single
judgment has been recorded.** Locked. Anything added after the first number is
looked at goes in a section headed "exploratory, added after unblinding", or it
does not go in.

## The question

Ship 1 published that fourteen of fifteen rules fail their own evidence bar.
Two readings fit that same data, and nothing this project owns distinguishes
them:

- **A.** The instinct is unreliable. The accused-defence position is right.
- **B.** The instinct is real and the instruments are crude. Publishing the
  failures as exoneration would be this project's biggest over-claim.

This instrument exists to separate A from B. It is the only one of the three
axes with no data, and nobody outside can build it: detector vendors have no
human-corpus provenance, humanizer vendors cannot publish against their own
upsell, and the Reddit study measures what people post rather than what they do
when tested.

**Perceived is not believed.** What people say the tells are is already
measured. What readers actually flag, shown text of known provenance, is not.

## The sample is biased, and that goes on the instrument itself

Visitors to humansounding.com arrived searching for AI tells. They are primed in
the direction under test.

This is stated **in body text on the collection page, not in a footnote.**

The consequence is carried into every published sentence: accuracy measured here
is an **upper bound** on a general reader's accuracy, not an estimate of it.

## Hypotheses

**H1 (primary).** Overall accuracy on period-matched passages exceeds chance.
Seeded bootstrap over documents, 2,000 draws, 95% CI on accuracy excludes 0.50.

**H2 (primary — the crux).** Accuracy is higher on judgments the reader
attributes to a **content cue** ("something it mentioned") than on judgments
attributed to a **style cue** (word choice, rhythm, structure). Bootstrap CI on
the difference excludes zero.

If H2 holds, a meaningful share of what people call *hearing the AI* is really
*noticing what the text knows*. That partly resolves reading B and explains why
a style instrument found fourteen failures: style was never what the instinct
ran on. This comes straight out of Gregg's iPhone 6 objection, and it converts
the dating leak from a threat into the measurement.

A null on H2 is the more convenient result for the existing published position,
which is exactly why the direction is predicted here in advance.

**H3 (the estimand the site actually publishes).** False-positive rate: the
share of *human* passages called AI, with CI. No directional prediction. This is
the number the accused-defence position stands or falls on, and it is reported
whatever it turns out to be.

**H4 (control, known negative — the one that can kill the run).** Accuracy on
human passages does **not** differ between the 2017-2022 Substack stratum and
the 2004 Blog Authorship stratum. If it does, the dating leak survived the
controls, H1 is contaminated, and no accuracy headline ships from this run.

H4 is included so that a run where everything separates can be recognised as a
leak rather than a triumph. It is the same role `lexical_density` plays in the
slop preregistration.

## Design

**Format: one passage at a time, "Human or AI?"** Not forced-choice pairs.
Single-passage matches the shape of a real accusation, which is what the site is
about, and it is the only format that yields H3 at all.

**Base rate 50/50**, randomised per trial from a fixed seed, and **stated on the
page**. A reader who cannot tell scores 50%; a reader who knows the base rate
cannot beat it with a guessing strategy.

### Passages

**Human side, stratified — both strata required so H4 is testable:**

- Substack public archives, 2017 to 2022-11-30 (854 documents available).
- Blog Authorship Corpus, blogger.com August 2004 (40 documents available).

**Model side:** a **new period-matched arm**. The existing model arms write
timeless topics; this arm is prompted on period-anchored topics drawn from the
same years as the human strata, so both sides carry dated content and the era
cue stops discriminating. This is control 1, the strongest of the three, and it
is a prompt change on the existing harness rather than new machinery. **Model
anachronisms are logged as findings, not silently dropped.**

**Excerpt window:** a fixed 120-200 words taken at a deterministic offset — the
first paragraph boundary at or after word 50. Never chosen by a person and never
chosen by a model.

**Selection:** seeded reservoir sample within the stated strata.
`collect-human.mjs` is already seeded; the job here is not to break it.

**No model writes or selects a human passage.** Gregg's rule, and the corollary
matters as much: no model curates "good examples" of either side, because a
model picking examples biases toward what a model believes human writing looks
like.

### Light screening — control 2, second pass only

Automated stoplist drop for a four-digit year token, a currency amount, or a
named product from a fixed list, **applied identically to both arms**. Counts
dropped per arm are logged and published.

Heavy filtering is refused. It biases the human set toward abstract prose, which
is a genre restriction wearing a disguise, and genre has killed more findings
here than anything else.

### Reason capture — control 3, required on every judgment

One follow-up, one choice, mandatory:

> word choice · rhythm or sentence shape · structure or formatting ·
> something it mentioned · gut

Cheapest control and the most valuable measurement in the design. It is what
makes H2 possible.

### What is recorded, and what is never recorded

**Recorded per judgment:** passage id, arm, stratum, judgment, reason, response
time in ms, a random per-session id, ordinal within session.

**Never recorded:** anything identifying the visitor. No IP, no user agent, no
fingerprint, no persistence beyond the session id.

## The floor, and the guard that enforces it

**Unit of independence is the document.** The bootstrap resamples passages, not
judgments, seeded, 2,000 draws, matching `study/slop.mjs`.

All of the following before any number is read:

- at least **120 distinct passages** entering analysis (>=60 human, >=60 model)
- at least **20 passages in each human stratum** (H4 is untestable otherwise)
- at least **400 completed judgments**
- at least **8 judgments on a passage** for that passage to enter analysis
- at least **50 distinct sessions**, and no single session contributing more
  than 5% of judgments

`study/perceived.mjs` refuses to print a verdict until these are met, the way
`slop.mjs` does, and any `--force` output is labelled not-preregistered-valid.

## How long the floor takes at current traffic

Recorded now, before the build, because it decides whether this ship is worth
building in this order.

Sessions: **21 in the last 7 days, 46 in the 7 before** (Supabase `daily_stats`,
2026-09-07). Call it 20-45 per week.

- If 20% of sessions start the quiz and a starter completes 10 judgments:
  40-90 judgments/week, and the 400 floor lands in **5-10 weeks**.
- If 10% start: **9-20 weeks**.

**These are assumptions, not measurements.** The true start rate is unknown
until the instrument is live, and the ranges above are wide enough to be nearly
useless as a forecast. That is the point of writing them down first.

**Consequence, recorded before any result: this instrument is
distribution-bound, not build-bound.** Building the quiz is the small half of
Ship 2. Getting 400 judgments through it is the large half, and nothing in the
current traffic supports the assumption that it happens on its own.

**Stop rule.** Six weeks after launch, if the floor is not met, either the
instrument gets deliberate distribution or the study is reported as **not-run**,
with the counts to date. It does not get a quiet underpowered read.

## Decision rules, set in advance

- **Publish if the floor is met, whatever the result.** Including null.
  Especially null.
- **If H4 fails**, report H4 and the contamination. No accuracy headline ships.
- **If the floor is not met by the stop rule**, publish the counts and the fact
  that it did not reach power. Refusing is the point; the design guard exists
  because refusing is the point.
- **No metric, hypothesis or stratum is added** after the first number is looked
  at. A hypothesis invented once the data are visible is a hypothesis fitted to
  the data.

## Known limitations, stated up front

1. **Biased sample.** Upper bound on accuracy, not an estimate of it.
2. **Passage length.** 120-200 words is short. Real accusations happen on longer
   text, so short excerpts likely understate accuracy.
3. **Corpus-bound.** The model side is our arms and our prompts. This measures
   perception of the models we sampled, in the genres we sampled.
4. **The period-matched arm is new and unvalidated.** If it fails to carry dated
   content, control 1 has not actually been applied and H4 becomes the only
   defence left standing.
5. **One reason per judgment.** Readers often do not know what decided it.
   "Gut" is a real answer and is expected to be common; a high gut share is
   itself a result about the instinct.

## What gets built, in order

1. The period-matched model arm: prompt set, then generation.
2. The passage packet builder: seeded, stratified, screened, deterministic
   excerpting.
3. The collection page, with the bias statement in body text.
4. Storage.
5. `study/perceived.mjs` with the design guard — **written before the first
   judgment is collected**, not after.

Nothing in steps 1-5 changes anything in this file.
