# Can the human corpus carry a public claim?

2026-08-29, in answer to: were these mostly written by one person, is 40
documents enough, and is any of this safe to say out loud.

## Straight answers

**How many authors: we do not know, and the manifest cannot tell us.**
`corpus/medium/MANIFEST.tsv` has four columns — file, source, date,
why_known_human. Every row says `medium`. There is no author field. That is a
real gap in the record and it is worth fixing rather than arguing around.

**Circumstantially it looks like roughly 40 different people.** The 40 documents
are a Google Cloud Functions tutorial, a poem called "Religion For Sale," a
Telangana government vaccination bulletin, an NFT art fair writeup, a piece on
breastfeeding pain, a Kotlin RatingBar tutorial, a Netflix strategy essay, a
federated learning explainer, an addiction-relapse memoir, an artist interview,
and a finance piece bylined "By Paul Sacks & Ari Pine." No single person writes
all of that. I would bet heavily on 35 to 40 distinct authors. But a bet is not
a record, and you asked precisely because you do not want to publish a bet.

**There is a specific hole in the collector.** `collect-human.mjs` caps each
source file at two documents "so one prolific author cannot dominate," and the
study README advertises that safeguard. That cap is skipped for `csv` and
`jsonl` inputs, because one CSV legitimately holds a whole corpus:

```js
const MANY_PER_FILE = ["csv", "jsonl"].includes(FORMAT);
...
if (!MANY_PER_FILE && perFile >= 2) break;
```

The Medium arm carries a real publication date on every row, and only the csv
and jsonl paths read a date column. So the Medium arm was collected through the
one code path where the per-author cap does not run. The blogauthorship arm in
`corpus/human/` used the blogger path, where the cap did apply, so that set has
at least 20 distinct bloggers by construction.

**I tried to measure author diversity and the test failed.** I computed pairwise
function-word cosine similarity within each corpus, expecting the human set to
be more internally varied than a single-model set. It came out 0.719 for the
human set, 0.797 for Claude, 0.765 for Gemini, and 0.669 for GPT-5.5. GPT-5.5 is
definitely one author and scored as more internally varied than the humans. The
test is measuring genre, not authorship, so it proves nothing in either
direction. Reporting it because a failed check I ran is worth more to you than a
check I quietly dropped.

## Is 40 documents enough?

For some claims yes, for others no, and the bootstrap already tells us which.
95% intervals, resampling whole documents:

| | rate | 95% CI |
|---|---|---|
| **em dashes** | | |
| Human (Medium) | 3.65 | [2.48, 4.92] |
| Claude Opus 5 | 11.05 | [9.64, 12.54] |
| ChatGPT (chat) | 3.52 | [2.17, 5.24] |
| **AI-favourite vocabulary** | | |
| Human (Medium) | 0.30 | [0.11, 0.53] |
| Gemini Flash | 0.96 | [0.61, 1.37] |
| Claude Opus 5 | 0.18 | [0.05, 0.37] |
| **paired dashes in a line** | | |
| Human (Medium) | 0.56 | [0.23, 0.91] |
| Claude Opus 5 | 1.65 | [1.20, 2.08] |
| GPT-5.5 | 0.00 | [0.00, 0.00] |

Claude's em dash interval clears the human interval by a distance roughly twice
the width of either. Gemini's vocabulary interval clears human's. Claude's
paired-dash interval clears human's. Those three gaps are not going to be
overturned by a bigger sample; they are 3x to 5x effects with clean separation.

ChatGPT's em dash rate sits directly on top of the human one. That is the
finding, not a failure of the sample.

**Split-half check.** Splitting the 40 human documents into random halves of 20,
the two halves disagree on the em dash rate by a median of 0.99 per thousand,
and by 2.25 at the 90th percentile, against a full-set rate of 3.65. So the
human em dash rate is stable to roughly plus or minus one, which is fine for a
3x claim and useless for a two-decimal one.

That is exactly what the published post already says: "The directions are the
finding. The decimal places are not." That sentence is doing real work and it is
already load-bearing.

## What this means for the issue you are about to file

I looked at every claim in it against this.

**Unaffected by the author question, because they do not involve the human
corpus at all:**

- Seven of 22 patterns never fired in 203,788 words.
- The default CI threshold of 70 cannot fire when the maximum observed score is 44.
- `references/patterns.md` scores 100 on its own rules.

**Unaffected, because it is a claim about file format, not about people:** the
formatting confound. It rests on 1 of 40 human documents containing `**` and 0
containing a markdown heading, against 36 to 40 of 40 in the AI sets. That is a
fact about how the text was scraped and stored. If one person had written all 40
Medium articles, the confound would be exactly as real. This is the main finding
in the issue and it does not depend on the answer to your question.

**The three replications do lean on the human baseline**, and two of them do not
need to. Restated between models, they need no human number at all:

- Gemini's vocabulary rate is 4 to 5 times every other model's (0.96 against
  0.18, 0.18, 0.22).
- Claude's paired-dash rate is 2.7 times ChatGPT's, 18 times Gemini's, and
  GPT-5.5 never does it once.

"Each tell belongs to one model" was always a between-model claim. Stating it
between models is both stronger and cheaper. Only negative parallelism really
needs the human comparison, and there the human rate is the highest of the five,
which is the safest direction to be wrong in: if the human number is off, the
rule looks worse, not better.

**My recommendation:** add four sentences to the issue saying what the baseline
is and what it is not, and restate the two replications between models. That
makes it stronger, not weaker. A reviewer who spots an unstated limitation
discounts everything; a writer who states it first gets the benefit of the
doubt on the rest.

## What to actually fix

1. **Add an author column to the manifest and backfill it.** The Medium dataset
   these came from has an author field. Recollect with it recorded, or match the
   40 back against the source and fill it in. One evening.
2. **Apply the per-author cap to csv and jsonl too**, keyed on the author column
   rather than the file. The safeguard the README promises should be the
   safeguard the code runs.
3. **Say the sample size in the post.** Forty documents, roughly 27,600 words,
   published 2018 to 2022, authors not individually recorded. Nobody has ever
   been embarrassed by stating their n.

Until 1 and 2 are done, the defensible sentence is: *"a 40-document sample of
Medium articles published between 2018 and 2022, sampled at random from a
public pre-ChatGPT dataset; author identities were not recorded."* That is
honest, it is checkable, and it does not claim more than the record supports.
