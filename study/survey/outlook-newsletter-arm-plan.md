# Using your Outlook for a genre-matched human newsletter arm

2026-08-29. Answer to: can you search my Outlook for pre-ChatGPT newsletters,
nothing with PII.

## Yes, and the material is real

I searched your mailbox for pre-2022-11-30 mail matching newsletter language and
read one body end to end to see what extraction would look like. It works.

The Rhino Newsletter #247 (2022-04-13) contains roughly six paragraphs of
genuine editorial prose — a Jazz Appreciation Month piece, a Grateful Dead
Europe '72 item, Depeche Mode, the Monkees, Record Store Day, Blur — wrapped in
about 40 KB of nested table markup and tracking links. After extraction it is
perhaps 450 usable words. That clears the study's 100-word floor comfortably.

Distinct senders with real editorial prose in the first 50 results:

Rhino · Craft Recordings ("The Circular") · Light in the Attic ("Liner Notes") ·
nugs.net · HBO Max streaming guide · Washington Post ("The Post Most") ·
Benzinga · WNYC Greene Space · Roger Williams University ("Reopening Roger") ·
Relix · Learn Jazz Standards · Tom Luther Music · Movies Anywhere ·
Keeper Security

Fourteen distinct senders, and the search still reported more results. Forty
documents at a maximum of two per sender is reachable, though it will take
several pages and some manual judgement.

## Why this is worth doing

The `newsletter` genre is one of the eight the AI arm was prompted for, and the
human-arm sourcing note from August 18 flagged newsletters as the hard one to
source cleanly. Your inbox solves that: real newsletters, sent to you, dated by
the mail header, from before ChatGPT existed.

It also fixes the manifest problem from this morning. **The sender is the author
field.** One row per document recording sender domain, subject, and the header
date gives this arm the provenance the Medium arm does not have, and the
existing two-per-source cap becomes enforceable because the sender is a real key.

## Three problems, all solvable, one of them serious

**1. PII is everywhere, and worse than you would guess.** In the fifty results I
looked at, without opening most of them:

- The Rhino body footer contains "This email was sent to: gregg@iwestgate.com"
- A Ridge message carries a UPS tracking number in full
- Every tracking URL contains a per-subscriber hash, which is an identifier
- A DHL message opens "Hola GREGG WESTGATE"
- The Microsoft 365 digests are addressed to "WESTGATE FAMILY"
- A Udemy subject line embeds your email address
- **A Roger Williams University admissions message opens "Hi Joseph,"** — a
  family member's name attached to a college admissions record

So a PII scrub is not a nicety. It has to be a hard filter, run before anything
is written to disk: strip all URLs, strip every email address, strip the footer
block, drop any document that still matches a name, phone, tracking-number or
address pattern, and drop transactional mail entirely (shipping, credit,
retirement accounts, order confirmations, university admissions).

**2. Half of what matched is not a newsletter.** "Your order is out for
delivery," an Experian credit-file notice, a DHL delivery notice, a Transamerica
IRA confirmation, a Zoho demo template still containing a literal
`{{FirstName}}` placeholder. All of that has to be excluded, and the placeholder
one is the same trap as the cover letter.

**3. Register.** These are professionally written, edited, house-voice marketing
newsletters. The AI arm's newsletter documents are a model's first draft. So the
comparison partly measures editing, which is the exact caveat the study README
already raises about pre-2022 published prose.

That is a caveat, not a disqualification, and it cuts an interesting way. If
2020 marketing newsletters turn out to score *high* on the AI-favorite
vocabulary, that is a real finding: the vocabulary would be marketing register
rather than machine register, and it would explain why those words feel like
slop. Either result is publishable. That makes this worth running.

## How it should actually be built, and how it should not

**Not through me directly.** Each message body arrives as roughly 40 KB of HTML.
Forty of them is over a megabyte of your mail read into this conversation, most
of it markup, and it puts your inbox contents through the model for no reason.

Two better routes:

**Option A, a subagent does the reading.** I dispatch a worker with the mail
tools and a strict brief: iterate the search, apply the exclusion list, extract
text, run the PII scrub, write `corpus/newsletter/*.txt` plus a MANIFEST.tsv,
and report back only counts and a per-sender tally. The bodies live in that
worker's context and never enter this one or any file except the scrubbed
output. Fastest path, and you would review the output files before anything is
measured.

**Option B, you export and I write the extractor.** You select the messages in
Outlook, drag them to a folder under `D:\Projects\HumanSounding\study\`, and I
add an `eml`/`msg` format to `collect-human.mjs` that does the same extraction
and scrubbing locally. Slower to set up, but the mail never leaves your machine
and the extraction is auditable code you keep.

Option A is faster. Option B is the one that matches the principle already
written into the study README: *"Collection therefore has to happen on Gregg's
machine."*

## Whichever route, the rules

- Hard date cutoff: received before 2022-11-30.
- Maximum two documents per sender domain.
- 100-word floor after extraction, 2,500-word ceiling, same as every other arm.
- Exclusion list: shipping, order, delivery, tracking, invoice, receipt,
  credit, account, password, admissions, and anything addressed to a named
  individual other than you.
- Strip all URLs, all email addresses, all phone numbers, and the legal footer.
- Drop any document containing a template placeholder.
- Text stays local. `.gitignore` covers it the same way it covers the human arm.
  Publish rates, and the derived per-document counts, never the text.
- MANIFEST.tsv gets a sender column. That column is the author field this study
  has been missing.
