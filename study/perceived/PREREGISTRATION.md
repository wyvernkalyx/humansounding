# Perceived axis: preregistration

Written 2026-09-07, **before any collection code exists and before a single
judgment has been recorded.** Locked. Anything added after the first number is
looked at goes in a section headed "exploratory, added after unblinding", or it
does not go in.

## Amendments

Amendments are dated, reasoned, and recorded above the text they change. The
original wording stays in the file. An amendment is only legitimate here when it
is made **before any judgment exists**, and when the reason is that the rule
could not be executed — not that the result was unwelcome.

### Amendment 2 — 2026-09-11: collection window extended, and every judgment is dated

**Changed:** collection may continue past the six-week stop rule until the
floors are met. The six-week checkpoint still happens and its counts are still
published; what changes is that "not yet at the floor" no longer ends the run.

**Added:** every judgment records the **UTC date it was collected**, alongside
the fields already listed under "What is recorded". This field does not identify
the visitor and does not extend what is known about them — the session id stays
random and per-session, and nothing else is added.

**Added — D1, a required diagnostic, not a hypothesis.** Judgments are split into
three equal parts by collection order and accuracy is compared across the first
and last part. Reported whatever it shows, in the same place as H3. D1 is **not**
a primary result and no publication decision turns on it; it exists so that a
reader can see whether the answer held still while it was being collected.

**Why the window had to change.** The rule could not be executed within its own
timeframe, and the arithmetic was already in this file — in two bullets whose
product was never taken.

> at least **120 distinct passages** entering analysis
> at least **8 judgments on a passage** for that passage to enter analysis

A passage under 8 judgments does not enter analysis, so it does not count toward
the 120. **The binding floor is therefore 960 judgments, not the 400 stated.**
The section "How long the floor takes at current traffic" computed 5-10 weeks
from 400; against 960 the same assumptions give 11-24 weeks, and six weeks of
measured traffic (21 sessions in the 7 days to 2026-09-07, 46 in the 7 before)
yields roughly 240-540 judgments. The stop rule as written would retire the
instrument before it could ever have reached power, under this file's own
optimistic assumption. That is a rule that cannot be executed, which is the only
ground on which this file permits an amendment.

**What the extension costs, stated in advance.** 960 judgments gathered over a
year are not 960 judgments from one population. Readers in late 2027 will have
had another year of exposure to AI writing than readers in late 2026, so the
thing being measured moves while it is measured, and the bootstrap's assumption
that passages and judgments are exchangeable is weakened. This is the reason the
date field and D1 are part of the same amendment: the cost is accepted, and it
is made **auditable** rather than absorbed silently.

**Whether a year is even enough is unknown and becomes knowable quickly.** The
20% quiz-start rate in this file is a guess, and 960 judgments needs roughly 23
weeks at 20%, 46 weeks at 10%, and 91 weeks at 5%. The start rate is measurable
within about two weeks of launch and should be recorded here when it is.

**What does not change.** No hypothesis, no floor, no stratum, no screening rule,
no decision rule, and not the ban on reading results early. H1 through H4 are
untouched. The design guard in `study/perceived.mjs` still refuses to print a
verdict until every floor is met, and `--force` output is still labelled
not-preregistered-valid. Publishing a result before the floor is met remains
forbidden, and the six-week checkpoint remains a public report of the counts to
date rather than a quiet look at the answer.

**No judgment existed when this was written.** The collection page does not exist
either; `study/perceived/packet.mjs` was written the same day and the passage
packet had not been generated.

### Amendment 1 — 2026-09-08: excerpt boundary changed from paragraph to sentence

**Changed:** the excerpt window's deterministic offset is now *the first
**sentence** boundary at or after word 50*, previously *the first **paragraph**
boundary at or after word 50*.

**Why.** The rule could not be executed on one of the two required human strata.
**39 of the 40 documents in the 2004 Blog Authorship stratum are a single line**
— no blank-line breaks and no internal newlines at all. Whether that is how the
corpus was distributed or an artefact of how it was exported has not been
established, and the answer does not change the arithmetic: with no paragraph
boundary in the text, the paragraph rule returns no offset and the stratum
yields **zero** passages.

Zero passages in the 2004 stratum makes the floor of "at least 20 passages in
each human stratum" unreachable and **H4 untestable**. H4 is the known-negative
that detects a surviving dating leak, so losing it would leave H1 with no
contamination check — the one failure mode this design was built to catch.

**Measured yield of each rule** (documents producing a valid >=120-word window,
2026-09-08, **before** the light screening in control 2, which will reduce all
three counts):

| stratum | documents | paragraph rule | sentence rule |
| --- | --- | --- | --- |
| Blog Authorship 2004 | 40 | 0 | 26 |
| Substack 2017-2022 | 854 | 852 | 853 |
| period-matched model arm | 80 | 80 | 80 |

The 2004 margin over the floor of 20 is thin and screening eats into it. If the
screened count lands under 20, the stratum fails its floor and H4 is reported as
not testable — that consequence is unchanged by this amendment.

**What this costs.** A sentence-boundary excerpt can begin mid-paragraph, so
passages may open without their local context. This applies **identically to
every arm and both strata**, so it does not favour a side; it is a uniform
reduction in context that plausibly lowers accuracy across the board. Recorded
here as a limitation, not a correction.

**What was not changed:** no hypothesis, no floor, no stratum, no decision rule,
no screening rule. The window stays 120-200 words, still deterministic, still
never chosen by a person or a model.

**Standing at the time of this amendment:** no collection page exists, no
storage exists, and no judgment has been recorded.

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

**Excerpt window** (amended 2026-09-08, see Amendment 1)**:** a fixed 120-200
words taken at a deterministic offset — the first **sentence** boundary at or
after word 50. Never chosen by a person and never chosen by a model.

> Superseded original, 2026-09-07: "**Excerpt window:** a fixed 120-200 words
> taken at a deterministic offset — the first paragraph boundary at or after
> word 50. Never chosen by a person and never chosen by a model."

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
