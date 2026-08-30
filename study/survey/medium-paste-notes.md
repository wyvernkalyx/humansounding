# Medium: what to set, and what breaks on paste

For the replication article. Everything below the comment block in
`medium-replication-post.md` is the body.

## Settings

**Title:** I ran three AI-writing checkers over the same 456 documents

**Subtitle:** Three rule sets written by three people, one pile of text. Where
they agree, where they are wrong in the same way, and the dataset nobody in this
field has.

**Canonical link** (Advanced settings, "Customize canonical link"):
`https://humansounding.com/blog/do-ai-writing-checkers-agree.html`

This is the one that matters. Without it Medium can outrank humansounding.com
for your own article, and every reader it earns lands on Medium instead of on
the checker.

**Hero image:** `og-replication.png`, already in the repo root. Medium dropped
the figcaption last time, so add the caption by hand after uploading: *Three
rules written by three people, run over the same 456 documents against the same
human baseline. Claude lands about three times the human rate in all of them.*

**Topics:** artificial intelligence, writing, chatgpt, ai-detection, data-science

**Paywall:** off, same as the last two.

## What breaks on paste

- **The `**` in the decorative-formatting section.** The article quotes a
  markdown pattern as `` `**` `` inside code ticks. Medium's editor sometimes
  eats the backticks and turns the asterisks into bold, which makes the sentence
  meaningless. Check that paragraph reads "Exactly one of the forty contains a
  `**`" with the asterisks visible.
- **The regular expression** `^\s*[-*]\s+\*\*[^*]+:\*\*` needs to survive as
  literal text. Set it as inline code, or Medium will italicize half of it.
- **The h3 subheads** in "Where they agree" come through as h2 by default. Drop
  them to the smaller heading so the section structure still reads.
- **Numbers with decimals** are fine, but check the run of five word counts in
  "The part that surprised me" did not get auto-formatted into a list.

## After publishing

Check both older posts while you are in there. The self-narration article and
the corpus study article both need the canonical link pointing at their
humansounding.com pages, for the same reason as above. If the canonical was
never set on those two, that is worth fixing before anything else here.

## One thing to check on the renamed article

The site title reads: **Why does AI keep apologizing and rating its own
answers?**

"Its" possessive, no apostrophe. "It's" means "it is", which would give "rating
it is own answers". Worth a look at the Medium title, since a grammar slip in
the headline of an article about writing quality is the kind of thing a reader
will mention instead of the argument.
