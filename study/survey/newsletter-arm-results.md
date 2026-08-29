# The newsletter arm: 25 documents, and a third human em dash rate

2026-08-29. Built from Gregg's Outlook, pre-ChatGPT, scrubbed. Files at
`study/corpus/newsletter/`.

## What was collected

25 documents, 10,482 words, 19 distinct sender domains, no domain over the
two-document cap. Dates run 2016-03-08 to 2022-11-25, every one before
ChatGPT's public launch. Median document 345 words, range 102 to 1,644.

Senders: Rhino, Craft Recordings, Light in the Attic, nugs.net, Legacy
Recordings, Dead.net, Relix, HBO Max, WNYC, Roger Williams University, NYC DEP,
Benzinga, Keeper Security, Soylent, Propellerheads, Caavo, Learn Jazz
Standards, Tom Luther Music, MMCO.

**The target was 40 and the honest answer is that the mailbox does not hold 40.**
Six domains hit the two-document cap; the other thirteen have exactly one
qualifying message each. Most pre-2022 mail in there is transactional or
image-only. Twenty-five clears the study's 20-document verdict floor, so the arm
is usable, but it is smaller than the other arms and that has to be stated
wherever it is quoted.

Rejections: about 55 screened out before extraction (roughly 25 transactional,
10 forwarded by family, 3 Microsoft 365 digests addressed to "WESTGATE FAMILY",
2 addressed to a named individual who is not Gregg including the Roger Williams
admissions message, 1 template placeholder), plus 8 rejected during extraction —
3 too short after scrubbing, 3 past the date cutoff, 1 carrying a personal
account number, 2 producing fragments rather than prose.

## Verification

I re-ran the PII check independently of the collector, on all 25 files, with my
own patterns: email addresses, URLs, runs of nine or more digits, the strings
Gregg, Westgate, iwestgate and Joseph, template placeholders, unsubscribe and
copyright footers, and US ZIP patterns. **Zero matches on zero files.** Word
bounds and dates check out, and the manifest has one row per file.

I read three files end to end. They read as connected editorial sentences, not
scraped fragments.

## The result

Em dashes, per 1,000 words, 95% bootstrap intervals resampling whole documents:

| set | n | words | rate | 95% CI |
|---|---|---|---|---|
| **Human newsletters (inbox)** | 25 | 10,482 | **1.05** | [0.22, 2.19] |
| Claude newsletters | 5 | 2,746 | 13.84 | [8.76, 19.34] |
| ChatGPT newsletters | 5 | 2,615 | 5.74 | [2.05, 9.57] |
| Gemini newsletters | 5 | 3,557 | 3.94 | [3.42, 4.40] |
| GPT-5.5 newsletters | 5 | 6,082 | 0.82 | [0.00, 2.63] |
| Human Medium (long-form) | 40 | 26,883 | 3.83 | [2.60, 5.20] |

**Two things fall out of that table.**

**One: there is now a third human em dash rate, and it is nothing like the other
two.** 2004 bloggers ran 0.18. Medium articles run 3.83. Marketing newsletters
run 1.05. Three sets of human beings, all writing before ChatGPT existed, spread
across a factor of twenty. The human newsletter interval [0.22, 2.19] and the
Medium interval [2.60, 5.20] do not overlap, so this is not sampling noise; it
is a real difference between two kinds of human writing.

The live post already says "anyone quoting a human em dash rate without saying
which humans is quoting noise." This is the third independent confirmation of
that sentence, and the first one where both sets are modern and both are
published prose.

**Two: against the genre-matched comparison, Claude's gap gets larger, not
smaller.** 13.84 against 1.05 is roughly 13x, where the Medium comparison gave
about 3x. The intervals are nowhere near each other. That is a stronger result
than the one in the post — and it is only fair to state it for the newsletter
genre, because that is the only genre the human set covers.

GPT-5.5's newsletters sit at 0.82, statistically on top of the human rate. Same
finding as before: it is a Claude habit.

## The hypothesis that died

Going in, the plausible worry was that marketing newsletters would be full of
the AI-favorite vocabulary, and that this would show the vocabulary is marketing
register rather than machine register.

It is not:

| set | AI-favorite vocabulary per 1,000 |
|---|---|
| Human newsletters (inbox) | 0.29 |
| Human Medium (long-form) | 0.30 |

Two completely different human corpora, different decades, different registers,
different collection methods, landing on 0.29 and 0.30. The human baseline for
that vocabulary is stable even where the em dash baseline is not. Worth saying
plainly: **the AI-favorite vocabulary is not marketing register.** Gemini's
newsletters run 0.84 and Claude's 0.73 against that same 0.29, though with five
documents per cell those intervals are wide.

Negative parallelism: human newsletters 0.10, human Medium 0.30, and three of
the four models fire it zero times in their newsletters. Still a dud.

## Correction to the first version of this note

The rates above were first reported as 0.86 and 3.65. Those came from my own
bare `—` count, not from the checker's shipped em-dash rule, which also catches
a few forms mine missed. Re-run through `study/measure.mjs`, which parses the
rule out of `checker.html`, the canonical figures are **1.05 [0.22, 2.19]** for
the newsletters and **3.83 [2.60, 5.20]** for Medium. 3.83 is also the number in
the published post, so the post was right and my recount was the approximation.
Direction, non-overlap and conclusion are unchanged.

## Caveats to carry

- **Five documents per AI newsletter cell.** The model intervals are wide and
  the Claude result is the only one that clears its comparison decisively.
- **Register.** These are professionally written and edited house-voice
  newsletters against a model's first draft. That difference is in the number.
- **Twenty-five documents, 10,482 words.** Smaller than every other arm.
- Nothing here changes the cross-model conclusion. It sharpens the genre-matched
  version of it and adds a third point to the "which humans" argument.

## Privacy note, and one thing to check before committing

The 25 text files are covered by the existing `.gitignore` rule
`study/corpus/*/*.txt`, and `newsletter/` is not in the allow-list, so they stay
local. Verified with `git check-ignore`.

**The manifest was the problem.** Every other arm's MANIFEST.tsv is tracked and
public. A newsletter manifest lists which newsletters Gregg subscribes to, which
together sketch a personal profile: a university, a municipal water authority, a
finance newsletter, a meal-replacement brand, a home-audio startup. I added an
explicit `.gitignore` line for `study/corpus/newsletter/MANIFEST.tsv` and
confirmed it takes effect. If a public manifest is wanted later, publish it
without the subject column and with sender domains replaced by category labels.

A stale `.git/index.lock` was moved to `_to_delete/` — the device shell cannot
delete, so remove that folder from VS Code.
