# Audit of the Gemini subreddit run

2026-08-29. What Gemini returned, what I could check from here, and what only you
can check.

## Verdict first

Better than the v1 run, and probably not fabricated, but **thin and partly
wrong**. Seven threads from ten subreddits is a low yield, and the one thread we
already know is the most interesting in the set is missing.

## What I could verify

**The post IDs are almost certainly real.** Reddit post IDs are base36 and
increase monotonically over time. I decoded all seven, plus the Verva thread
`1vsefkf` as a known-good control, and sorted them:

| ID | decoded | claimed date |
|---|---|---|
| 1oo6ot0 | 3,668,593,428 | 2025-11-04 |
| 1outdm1 | 3,679,729,705 | 2025-11-12 |
| 1p1ty9t | 3,691,513,793 | 2025-11-20 |
| 1pisuya | 3,720,016,306 | 2025-12-10 |
| 1rulqgr | 3,860,771,643 | 2026-03-15 |
| 1vsefkf | 4,098,936,399 | ~2026-08-19 (control) |
| 1vxz9ho | 4,108,306,380 | 2026-08-25 |
| 1w0l3tj | 4,112,684,695 | 2026-08-28 |

Strictly increasing, and the control lands exactly where it should. A model
inventing IDs would not get eight of them into the right chronological order
against a real anchor. Treat the permalinks as probably good.

**Ryne AI is the story in this batch.** ryne.ai sells both a detector ("AI
Report") and a humanizer, and its homepage claims, verbatim: **"Bypass Turnitin
and GPTZero with a 99.9% success rate."** Free tier is 250 words; paid starts at
$19.99/month.

Gemini says two of the ten subreddits are tied to Ryne AI (r/besthumanizeai and
r/FreeAIHumanizer), and two of the seven threads it found are Ryne promotions
posted in those subreddits, one of them a head-to-head against a competitor that
Ryne wins. That is the Verva structure again, one layer up: own the subreddit,
post the comparison, win it.

That 99.9% claim is also the most testable thing anyone in this space has said
out loud. We have 416 public AI documents. It is a falsifiable number.

**hidemy.ai is the correct domain** for HideMyAI.

## What I could not verify

**Reddit is blocked to my fetch tool in this session** (HTTP 403 from the proxy),
and I am not going to route around that. So every title, score, comment count,
and quote in Gemini's output is unchecked. Opening the seven permalinks is
yours; it is about five minutes.

## Where it is wrong or thin

**It missed the Verva thread.** `1vsefkf` is in r/humanizing, is from about ten
days ago, has 36 comments, and contains a ranked list whose top two entries are
the same company. Gemini searched r/humanizing and returned nothing from it. If
it missed that, it missed others.

**Section C mostly failed.** Creation dates: unknown for all ten, though the one
you and I can both see, r/humanizing, says "Created Nov 7, 2025" right on the
sidebar. Subscriber counts: unknown for seven of ten. And two numbers contradict
your own screenshots:

| subreddit | your screenshot | Gemini |
|---|---|---|
| r/humanizeAIwriting | 13K weekly visitors, 39 contributions | 14K visitors, ~22 contributions, "as of late 2024" |
| r/BestAIHumanizer_ | 275 visitors, 7 contributions | 264 visitors, 13 contributions |
| r/humanizing | 2K visitors, 58 contributions | unknown |

"As of late 2024" is impossible for a subreddit whose earliest thread Gemini
itself dates to November 2025. Your screenshots are the better source; use them.

**It also missed that r/humanizing is moderated by u/ai-humanizer**, which is
sitting in plain sight on the sidebar you screenshotted.

**Section B's "times named" counts are approximate by its own admission** (all
prefixed `~`), and almost every field is "unknown". That is the prompt working
as designed, but it means Section B is a list of names, not data.

## What I did with it

Added six products to the survey sheet, now 24 rows: ryne.ai, humanizerpro.ai,
writebros.ai, rephrasio.com, hidemy.ai, hix.ai. Only ryne.ai and hidemy.ai are
domain-verified; the rest are marked UNVERIFIED in the notes column.

## What to change in the prompt if we run it again

1. **Name the control.** Give it `1vsefkf` up front and require it to appear in
   the output. If it does not, the run failed and we know immediately.
2. **Ban stale figures.** Section C should require the number and the date it was
   read, and refuse anything it cannot date.
3. **Require moderator usernames**, not a judgement about whether the sub is
   vendor-tied. The usernames are on the sidebar and they are checkable.
4. **Drop Section B's mention counts.** Approximate counts across ten subreddits
   are not something it can do, and pretending otherwise fills the table with
   noise. Ask for the product list and the permalinks only.
