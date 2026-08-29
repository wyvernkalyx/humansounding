# BLUF: defending the prose-humanizer issue

## The claim, in one sentence

Their `decorative-formatting` rule produces 74% of all findings, and it fires
only on markdown, so it separates AI from human because their AI corpus is
markdown files and their human corpus is scraped plain text — not because of
anything about the writing.

Everything else in the issue is secondary. If you only defend one thing, defend
that.

## Numbers you must be able to back

| claim | number | where it came from |
|---|---|---|
| documents / words | 456 / 203,788 | all nine corpora, `prose-lint stats --json` word counts |
| decorative-formatting share | 750 of 1,016 findings | `prose-lint analyze --json`, summed |
| three rules share | 95.1% (966 of 1,016) | decorative-formatting + dash-cluster + tier1-vocabulary |
| `**` in human corpus | 1 of 40 documents | `grep -l '\*\*'` |
| markdown headings in human corpus | 0 of 40 | `grep -lE '^#{1,3} '` |
| `**` in AI corpora | 36/40 Claude, 40/40 Gemini, 26/40 GPT-5.5 | same grep |
| Gemini with the rule | 7.4x human (11.24 vs 1.52) | table |
| Gemini without it | 0.93x human (1.42 vs 1.52) | table |
| dead patterns | 7 of 22, zero hits in 203,788 words | analyze, summed |
| max score observed | 44, against a default gate of 70 | `prose-lint score` on all 456 |
| their own `references/patterns.md` | scores 100 | `prose-lint score references/patterns.md` |

**Word counts are theirs, not mine.** Every figure comes from their own CLI run
unmodified — `analyze --json` and `stats --json`. Their word counter differs
slightly from `wc -w` (586 vs 583 on one file, because it excludes code and
frontmatter). Say that if the numbers are questioned; it is a point in your
favour, not against.

## The five questions you will get

**1. "Isn't your whole study confounded then, not just my rule?"**

This is the strongest thing they can say and you should meet it head on rather
than defend.

Answer: for formatting rules, yes, and I have the same exposure — my human
baseline is plain text and my AI corpora are markdown, so any rule I write that
keys on markup would be measuring the same artifact. I have not shipped one, and
now I know not to without stripping markup first.

For prose rules it does not apply. Em dashes, vocabulary and sentence
constructions survive HTML-to-text scraping unchanged; a bolded-bullet regex
cannot survive it at all. That is the distinction: the confound hits rules that
key on markup, not rules that key on words.

**Concede this immediately if asked:** there is a second-order version of it in
punctuation. Scraped HTML preserves curly quotes; text written to a file by an
API tends to use straight ones. Any rule counting curly quotes has the same
problem. I found exactly that in a third project's ruleset while checking this
one.

**2. "Only 40 human documents, and you do not know who wrote them."**

Already conceded in the issue, which is why it is in there. Add: the finding is
1 of 40 versus 36-to-40 of 40. That gap does not need author diversity or a
larger sample; it is a fact about file format. If someone wants to press on
sample size, the em dash comparison has intervals — human 3.65 [2.48, 4.92]
against Claude 11.05 [9.64, 12.54] — and they do not overlap.

**3. "The rule is doing its job. Models really do write bolded bullets."**

Agree instantly and without hedging. The issue says so already. Your complaint
is narrower: the rate is not comparable between a markdown source and a
plain-text one, and `score` mixes it into a single number with prose rules that
are comparable. The fix you proposed is a `--no-format` flag or a note in the
README, not deleting the rule.

**4. "Maybe 70 is aspirational, not a real gate."**

Fine, but the observation stands: on 456 documents including a heavily
markdown-formatted Gemini set, nothing scored above 44. A pre-commit hook that
never fires is not protecting anybody. Suggest they calibrate the default
against real documents.

**5. "Show me the data."**

416 AI documents are public in the repo with prompts recorded in the manifests.
The human corpus is third-party writing so it stays local — you publish rates,
not text. You offered the per-document JSON in the issue; make good on that if
asked, it costs nothing and it is the strongest possible answer.

## What to concede fast, and what not to

**Concede fast:** author identities unrecorded; 40 is small; your own study has
the same markup exposure for any future formatting rule; the bolded-bullet
pattern is real.

**Do not concede:** the formatting finding itself. It does not depend on sample
size, author count, or your human corpus being any good. `^\s*[-*]\s+\*\*[^*]+:\*\*`
cannot match text that contains no markdown, and their human corpus contains
almost none. That is arithmetic.

## If they are hostile

Unlikely. Their README already says detector scores cannot prove authorship,
their CONTRIBUTING file asks for reproducible failure cases, and a third of your
issue is a compliment backed by their own numbers. If it does turn, the exit is:
"Happy to be wrong about this — run `analyze --json` over any plain-text human
corpus you trust and see whether decorative-formatting fires."

## One thing you are exposed on that nobody has raised yet

Your live post quotes a human em dash rate of 3.65 from the Medium corpus. As of
today you have a second modern human set — the newsletters — at 0.86, and the
intervals do not overlap. Nobody in that thread will know that. But if you cite
a human rate in the discussion, say which corpus it came from.
