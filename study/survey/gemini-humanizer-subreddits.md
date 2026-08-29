# Gemini prompt: what the humanizer subreddits are actually talking about

Written 2026-08-29 for the ten humanizer subreddits Gregg found. Companion to
`gemini-reddit-prompt.md` (v2), which hunts small checkers across general subs.
This one is narrower: it works a named list of vendor-adjacent communities and
comes back with threads and product names to feed the survey.

Carries the v2 verification rules forward. Two things are different: several of
these subreddits look vendor-operated, so self-promotion labelling is not
optional here, and the output has to be ordered by discussion volume rather than
by date, because the point is to find what people argue about.

Paste everything below the line into Gemini with search enabled.

---

I am researching the communities that form around "AI humanizer" tools. I want
two things: the discussions that draw the most engagement, and the products
people name in them.

## Search only these subreddits

Active, in rough order of size:

- r/humanizeAIwriting
- r/humanizing
- r/AiHumanizer
- r/bestaihumanizers
- r/HumanizerPro
- r/BestAIHumanizer_

Nearly dormant, but check anyway:

- r/besthumanizeai
- r/bestAIHumanizer
- r/FreeAIHumanizer
- r/bestaihumanizertext

Do not wander into r/ChatGPT, r/college, or any other subreddit. If a thread in
one of the ten links out to a discussion elsewhere, you may note the link, but
the thread itself must live in one of the ten.

## Hard requirements. An entry that fails one gets dropped, not guessed at.

1. **A full Reddit permalink**, in the form
   `reddit.com/r/SUBREDDIT/comments/ID/slug/`. A link to a subreddit is not
   acceptable. No permalink, no entry.
2. **For any product named: a working homepage URL.** If you cannot find one,
   omit the product. Do not write "URL unknown".
3. **Date range: the last twelve months only.**

I would rather receive six verified threads than thirty I have to re-check.

## Section A: the discussions

Up to fifteen threads, ordered by engagement (upvotes plus comment count),
highest first. For each:

| Field | Rule |
|---|---|
| Subreddit | |
| Thread title | verbatim |
| Permalink | required, full URL |
| Date | within 12 months |
| Upvotes / comments | give both numbers if visible, else "unknown" |
| What the thread is about | one sentence, plain description, no sentiment summary |
| Products named in it | list, or "none" |
| Best quote | verbatim, one or two sentences that show what people actually said |
| Looks vendor-operated? | yes / no / unknown. Say yes if the poster, the top comments, or the subreddit's moderators appear tied to a product |

I care most about threads on these topics, so surface them if they exist:

- Whether a humanizer actually beat a specific detector, with screenshots or
  results people posted
- Complaints about being falsely accused by a detector
- Complaints about a tool charging, gating results behind an account, or
  producing garbage output
- Students or freelancers describing what happened when they got caught
- Anyone arguing that detection does not work at all

## Section B: the products

Every tool named across those threads, whether it humanizes, detects, or both.

| Field | Rule |
|---|---|
| Product name | |
| Homepage URL | required, working |
| Humanizer, detector, or both | |
| Times named across the ten subreddits | a count, approximate is fine |
| One permalink where it is named | required |
| Account required before you see a result? | yes / no / unknown. Only answer if a thread says so or you can see the site yourself |
| Price floor | cheapest paid tier, or "free", or "unknown" |
| Self-promotion suspected? | yes / no. If most mentions come from accounts that look tied to the product, say so and keep the entry, labelled |

Order by mention count, highest first.

## Section C: who runs these places

For each of the ten subreddits, tell me: subscriber count, weekly contribution
count if visible, creation date if visible, and whether the moderators or the
bulk of posts appear tied to a specific product. One line each. Write "unknown"
rather than inferring.

## Rules that override everything above

Write "unknown" wherever you cannot verify. Never fill a field with a plausible
guess. Do not paraphrase quotes. Do not summarise the mood of a thread in place
of quoting it. If a section comes back thin, that is a finding and I want to see
it thin rather than padded.
