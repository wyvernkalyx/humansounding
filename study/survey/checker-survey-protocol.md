# Survey: what AI checkers ask for before they answer

Protocol, 2026-08-29. The claim under test is procedural, not statistical:
**how many AI checkers show you a result without an account, and how many take
your text before they tell you they won't.**

No corpus needed, no API, no statistics. It needs one fixed input, one fixed
sequence, and honest bookkeeping.

## The input, fixed for every site

`study/corpus/ai/claude-opus-5__blog_post__02.txt` — 3,254 characters, about
515 words, written by claude-opus-5 on 2026-08-18. Public and fetchable at:

`https://raw.githubusercontent.com/wyvernkalyx/humansounding/main/study/corpus/ai/claude-opus-5__blog_post__02.txt`

Using a published document matters more than it sounds. Anyone can rerun this
survey against the identical text, which is the difference between a survey and
an anecdote. It also means no real person's essay is handed to twelve vendors.

This replaces the cover letter originally specified here. That file carries ten
bracketed template placeholders ([Company Name], [Hiring Manager Name], [Date]
and so on), which a detector could reasonably score on their own. The blog post
has none, and at 3,254 characters it clears the 250-character minimum GPTZero
enforces and most other free-tier floors, while staying under the usual caps.

## The sequence, identical every time

1. Open the site in a **fresh private window**. No cookies, no session, not
   signed in to anything.
2. Open developer tools, Network tab, and clear it. Filter to Fetch/XHR.
3. Paste the text. Do not press anything yet.
4. Press whatever the primary button is (Check, Detect, Analyze, Humanize).
5. **Before dismissing anything**, look at the Network tab and answer: did a
   request leave the browser when you pressed the button, and where did it go?
   Then click it and read the payload. Sort by size; a request whose body is
   roughly 3 to 4 KB is the text.

   **Division of labour, revised 2026-08-29 after the automated pass failed.**
   You drive. Claude cannot be trusted to paste: GPTZero's box is a React
   controlled input that ignores a scripted value, so the field read
   "0/10,000 characters" while the scraper happily reported the page's marketing
   copy ("99% Accuracy") as a detection result. Claude also cannot read request
   bodies, only URLs, methods and status codes.

   So: you paste, press, look, and read the payload. Claude reads the page and
   the request list alongside you, writes the row, and asks the questions the
   protocol wants answered. Zero requests on press means the text stayed local.
   A POST to something named /detect, /analyze or /scan before any wall appears
   is strong evidence it did not, but only the payload settles it.
6. Record what appears on screen. Screenshot it.
7. Only then, if a wall appears, note exactly what it demands.

Step 5 is the whole survey. Everything else is context.

## What to record per site

| Field | How to answer |
|---|---|
| `site` | domain |
| `date_tested` | ISO date |
| `result_without_account` | yes / no / partial |
| `text_sent_before_gate` | yes / no / cannot tell. From the Network tab, not from the page copy |
| `what_free_tier_shows` | verbatim. e.g. "percentage only", "blurred text", "nothing" |
| `gate_demands` | email / email+password / payment / social login |
| `sells_humanizer_too` | yes / no |
| `privacy_claim` | quote it verbatim if the page makes one |
| `cheapest_paid` | price and period |
| `unfalsifiable_claim` | quote verbatim if present, else blank |
| `notes` | anything odd, e.g. placeholder text in the preview |

Record `cannot tell` freely. A survey with honest gaps is worth more than one
with confident guesses, and this project has already been bitten twice by a
number nobody checked.

## The sites

Verified as existing, from `claude/detector-landscape-2026-08-29.md`:

textguardai.com · quillbot.com · undetectable.ai · gptzero.me

Reported, verify before testing: pangram.com · originality.ai · copyleaks.com ·
scribbr.com · walterwrites.ai · phrasly.ai · editgpt.app · stealthgpt.ai ·
humbot.ai · zerogpt.com · sapling.ai · winston.ai

Twelve to fifteen is enough. Beyond that the marginal site adds nothing and the
evening gets long.

## What can be published, and what cannot

**Publishable, because it is observed fact:** the count, the per-site table, the
verbatim quotes, the screenshots. "Nine of twelve required an account before
showing a result. Seven of those transmitted the text before the account was
requested."

**Not publishable:** any claim about what a vendor does with the text after it
arrives. The Network tab shows that text left the browser. It cannot show
whether it was stored, trained on, or discarded. A vendor saying "we discard it"
is unverifiable from outside, and so is the opposite.

**The honest frame:** this measures what a user is asked to hand over before
getting an answer. It does not measure anyone's intent.

## Why HumanSounding is the control, not an entry

The checker here runs entirely in the browser and requires no account. One POST
does fire on press, to the Supabase `track` function, and the source shows it
carries rule counts and never text.

State that precisely rather than proudly. The Network tab shows a request left
the page; it does not prove what was in it, and that is exactly the limit this
survey applies to everyone else. What HumanSounding has that the others do not
is that `checker.html` is public, so a reader can verify the payload claim from
the source instead of trusting it. Put the row in the table, tested identically,
and say so.
