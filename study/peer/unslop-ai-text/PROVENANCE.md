# Peer data: unslop-ai-text

Pulled 2026-08-31 from
https://github.com/JCarterJohnson/vibecoded-design-tells (`unslop-ai-text/`),
the study behind the r/ClaudeAI post "I pulled ~90,000 Reddit posts about what
makes writing 'sound like AI' (Part 2)".

## What this is, and what it is not

It measures **what people say about AI writing**, not AI writing. 89,239 posts
harvested from the free Arctic Shift archive across 47 subreddits, 2021 to 2026,
filtered to 7,984 on topic, with a 600-post hand audit. Figures are shares of
on-topic posts.

**It can never become a study arm.** The posts are overwhelmingly post-2022 and
people paste AI examples into them constantly, so as a human baseline it is
contaminated by construction.

## What we pulled, and what we did not

Pulled: the derived tables, the quote bank, the study README, DATA_NOTE, and the
repository LICENSE.

Not pulled: `corpus_raw.jsonl`. It is 296 MB, gzips to 102 MB, and is not
committed to his repo either. It regenerates with his `collect.py` against
Arctic Shift, no API key required. We do not need it unless a number of his
fails to reconcile.

## Terms

Code in the source repository is MIT (see `LICENSE`). The harvested text carries
no separate data license and his DATA_NOTE states it "is public Reddit content
collected via Arctic Shift and belongs to its original authors."

`quote_bank.txt` and `synthesis.md` contain verbatim third-party posts and are
**gitignored**, under the same rule that keeps `study/corpus/*/*.txt` out of the
repository. Do not commit them and do not republish the quotes without going
back to the source thread. The quote bank carries no usernames.

The derived tables are aggregate counts rather than text and are committed, with
attribution to the source repository in this file.

## The two tables do not disagree, and here is why

On first pass the cited shares in `comparison.csv` and `verified_tally.csv`
looked contradictory. They are not. Resolved by running his
`build_verified_tally.py`, which reproduces `verified_tally.csv` byte for byte
from committed inputs.

- `comparison.csv` cite shares are the **raw count** over the 600-post audit
  sample. Bullet lists: 19 posts, 3.1%.
- `verified_tally.csv` cite shares come from `extract_result.json` at
  `synthesis.final_ranking`, the **post-audit** figure after his multi-agent
  pass deduped and reconciled the categories. Bullet lists: 1.7%, marked
  confidence high.

The published post uses the audited number, which is the right one. No error.

**One real difference between the post and the repo.** The repo ranks the
antithesis construction 2nd (2.8%, confidence high) and uniform rhythm 3rd
(4.0%, confidence medium). The post reverses them, presenting the list as
"ranked by how often people actually cite them", which is a straight sort by
share. Both orderings are defensible, the repo's being a considered ranking
that weighs confidence. The post just does not say it used a different one.

Also worth knowing for any citation: his own note on the rhythm row reads
"partly padded by generic 'sounds robotic' laments", and he rates it medium
confidence where he rates the em dash high. Quote the hedge with the number.
