# Reproducing the belief percentages

2026-09-01. Written before using any of these numbers on the site.

The two-axis checker design puts a "believed" figure next to every measured one.
Those figures are somebody else's work. Repeating a percentage because it is in
circulation is the exact failure this project documented in fifteen security
awareness vendors, so the numbers were checked first and are cited by name
wherever they appear.

## What can be reproduced here, and what cannot

**Cannot.** The raw corpus. `corpus_raw.jsonl` is 296 MB and is not committed to
his repository either. Regenerating it means running his `collect.py` against the
Arctic Shift archive, which is possible and was not done. So the harvest, the
on-topic filter and the hand audit are taken on trust.

**Can.** The arithmetic between his committed tables and his stated percentages.
That is what was checked.

## Method

`cite_share_sample_pct` was recomputed from `cite_posts` for all 42 rows of
`comparison.csv`, testing the denominator against the 600-post hand audit named
in his README. Wilson 95% intervals were added, which he does not publish.

## Result

All 42 rows reproduce from n=600. The largest discrepancy is 0.067 percentage
points, consistent throughout with truncation rather than rounding (43/600 =
7.167%, published as 7.1). Nothing in the table is inconsistent with the stated
sample.

| Item | Cited | Share | 95% CI |
|---|---|---|---|
| em dash | 43/600 | 7.17% | 5.36 – 9.51 |
| bullets and lists | 19/600 | 3.17% | 2.04 – 4.89 |
| "it's not just X, it's Y" | 19/600 | 3.17% | 2.04 – 4.89 |
| perfectly structured / formulaic | 15/600 | 2.50% | 1.52 – 4.08 |
| "dive in" / "deep dive" | 12/600 | 2.00% | 1.15 – 3.46 |
| delve | 8/600 | 1.33% | 0.68 – 2.61 |
| "as an AI language model" | 7/600 | 1.17% | 0.57 – 2.39 |
| "it's important to note" | 1/600 | 0.17% | 0.03 – 0.94 |
| however / thus / hence | 0/600 | 0.00% | 0.00 – 0.64 |

## The finding the intervals add

**Only the em dash separates.** Its interval, 5.36 to 9.51, clears every other
item on the list. Ranks two through five overlap each other completely: bullets
and the negation construction are the same count, and "formulaic" reaches 4.08
against their 2.04 floor.

So the ordering below first place is a tie, and any use of these numbers on the
site has to say so. This is the same caution we ask of readers of our own rates,
applied to somebody else's data, and it is the reason for adding intervals he
did not publish rather than quoting his ranking as a ranking.

Separately, `verified_tally.csv` reports 2.8% for the negation construction where
`comparison.csv` gives 3.1%, with a note that three variant rows merge into it.
On 2026-08-31 a similar gap between these two files turned out to be raw versus
post-audit counts rather than an error, so it is treated the same way here.
`build_verified_tally.py` was not among the files pulled, so this is not
confirmed, only bounded: the two figures differ by 0.3 points and both sit far
inside the interval above.

## Attribution

Source: JCarterJohnson, `unslop-ai-text`, in
`github.com/JCarterJohnson/vibecoded-design-tells`. 89,239 Reddit posts across
47 subreddits, 2021 to 2026, filtered to 7,984 on topic, 600 hand audited.

Percentages are his. The intervals are ours. Any site copy carrying a belief
figure names him.

## The limits to state wherever these are used

One study, one platform, one author's coding scheme. Reddit posts about AI
writing are not a sample of people who accuse other people of using AI, and the
population that argues about this in public is not the population that grades
essays. It is the best belief data that exists and nobody else in this space has
any.
