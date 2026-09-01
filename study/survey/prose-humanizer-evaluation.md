# Evaluation: amanmaqsood/prose-humanizer

Measured 2026-08-29 against the HumanSounding corpora. Repo at commit 6d08e33,
version 3.0.0, MIT.

## Short version

This is the most serious peer project I have seen in this space, and it is not a
competitor to the checker in the way the humanizer vendors are. It refuses to
claim authorship, it publishes its rules as machine-readable JSON, it has CI and
behavioral tests, and it makes no bypass promise. Its README says so directly:
"Prose Humanizer is not an AI detector and does not promise 'undetectable'
writing. Detector scores cannot prove authorship."

Then I ran its linter over 456 documents and 203,788 words of your corpora. Its
rules have the same problem yours did, in the same shape, for a reason nobody
has written down yet.

## What it is

An agent skill plus an optional Node CLI. No network calls, no telemetry, no
runtime dependencies, no bundled binaries. I read `bin/prose-lint.js` before
running it: two requires, both `node:fs` and `node:path`, one `writeFileSync`
reachable only through `fix --write`. No `child_process`, no `fetch`, no
`process.env` reads, no eval. The installers copy files into `~/.claude/skills`
and `~/.gemini/commands` and nothing else. It is safe to run.

Five modes: draft, rewrite, voice match, detect, file-safe edit, repo audit. The
CLI does `analyze`, `score`, `stats`, `fix`, `scan`, and a pre-commit hook.

Written 2026-08-22 in seven commits over about two hours, all by one author. The
tag says 3.0 because versions 1 and 2 were the same afternoon.

## Where it agrees with you

Its stated principles land on the same conclusions your measurement forced:

- "Patterns need context. One watched word or punctuation mark proves nothing."
- "Variation needs a reason. Random mistakes and forced fragments create another
  artificial fingerprint."
- "Truth beats texture. A believable invention is still an error."
- The score is `min(100, 600 x total matched weight / word count)`, published in
  the README, and labelled "not a probability and not evidence of authorship."

It arrived at your framing independently. It credits four other open projects in
ACKNOWLEDGMENTS.md, none of them yours.

## What I measured

`prose-lint analyze --json` over every document in nine corpora. Rates per
1,000 words. Long-form sets only in the table below; the chat sets are in the
totals.

| rule | Human (Medium) | Claude Opus 5 | Gemini Flash | ChatGPT (chat) | GPT-5.5 |
|---|---|---|---|---|---|
| decorative-formatting | 0.00 | 0.05 | **9.83** | 0.18 | 1.83 |
| dash-cluster | 0.51 | **1.69** | 0.10 | 0.62 | 0.00 |
| tier1-vocabulary | 0.29 | 0.19 | **1.03** | 0.18 | 0.23 |
| filler-phrase | 0.29 | 0.00 | 0.05 | 0.00 | 0.00 |
| negative-parallelism | 0.18 | 0.00 | 0.05 | 0.09 | 0.17 |
| hedge-stack | 0.14 | 0.00 | 0.05 | 0.00 | 0.06 |
| all others combined | 0.11 | 0.05 | 0.15 | 0.00 | 0.17 |
| **TOTAL** | **1.52** | **1.97** | **11.24** | **1.06** | **2.46** |
| **TOTAL minus formatting** | **1.52** | **1.92** | **1.42** | **0.89** | **0.63** |
| words | 27,648 | 21,360 | 20,458 | 11,293 | 17,502 |

## Four findings

**1. The Gemini result is a file-format artifact, not a prose finding.**

`decorative-formatting` is 750 of 1,016 total findings across all 456 documents.
It matches two things, and the one that fires is a markdown bullet carrying a
bolded label: `^\s*[-*]\s+\*\*[^*]+:\*\*`.

Your human corpus is scraped Medium prose. One of its 40 documents contains a
`**` anywhere. Zero contain a markdown heading. Your AI corpora were written to
files by an API and arrive as markdown: 36 of 40 Claude documents, 40 of 40
Gemini, 26 of 40 GPT-5.5.

So the rule cannot fire on the human set for a reason that has nothing to do
with writing. Strip it out and every model lands at or below the human rate.
Gemini goes from 7.4x human to 0.9x. This is your genre-and-length confound
again wearing different clothes: the measurement was picking up the medium the
text was stored in.

That is not a flaw unique to this project. If your own study ever adds a
formatting rule, it will land in the same hole, and your human baseline is the
reason.

**2. Three of your findings replicate under someone else's rule definitions.**

This is the part worth writing up.

- *Gemini vocabulary.* Their `tier1-vocabulary` is 54 words, chosen by a
  different person from a different source. Gemini 1.03 per thousand, human
  0.29, other models 0.18 to 0.23. You measured 1.01 against human 0.33 with
  your own word list. Two independent lists, same conclusion.
- *Claude dashes.* Their `dash-cluster` is not a density rule at all; it matches
  a pair of em dashes inside one line. Claude 1.69, human 0.51, a 3.3x gap.
  Your em dash density gave 2.9x. Different operationalization, same finding.
- *Negative parallelism is a dud.* Human 0.18, GPT-5.5 0.17, ChatGPT 0.09,
  Gemini 0.05, Claude 0.00. The rule everybody cites, running at or below the
  human rate in every model, in a second independent implementation.

Your post says each tell belongs to one model. An unrelated ruleset, applied to
the same corpora, says it too.

**3. Seven of its 22 rules never fired once in 203,788 words.**

`significance-inflation`, `copula-avoidance`, `fake-alternative`,
`aphorism-formula`, `prompt-echo`, `chatbot-artifact`, `knowledge-disclaimer`.

Yours had nine of fifteen do the same thing. Same cause: rules inherited from
2023-2024 descriptions of chatbot behavior that the labs have since tuned out.
`chatbot-artifact` and `knowledge-disclaimer` are the "As an AI language model"
family. They are gone.

Three rules produce 95 percent of all findings. The other nineteen are decoration.

**4. Its shipped CI threshold can never fire.**

The pre-commit hook and `scan --fail-above` default to 70. The highest score any
of 456 documents reached was 44, and that includes the Gemini markdown-heavy
ones. A gate set at 70 will pass everything.

Their own `references/patterns.md` scores 100, because it quotes the patterns it
documents. So `prose-lint scan docs/` over any repository that documents writing
style will flag its own documentation and nothing else.

## What you could take from it

- **The JSON rule file.** `rules/patterns.json` is a clean format: id, label,
  category, weight, kind (word/phrase/regex), values, suggestion. Yours are
  parsed out of `checker.html` at runtime, which was the right call for keeping
  study and site in step, but a published JSON file is what makes a ruleset
  citable by other people. This is the single most copyable idea in the repo.
- **The transparent score formula.** Published in the README, computable by
  hand, explicitly not a probability.
- **`stats`.** Sentence lengths, paragraph sizes, vocabulary ratio, repeated
  trigrams. You do not have a descriptive mode, and a reader who has just been
  told "this is not a verdict" wants something to look at.
- **A confidence label tied to sample length.** They print "low confidence" on
  short input. You now print "Too short to measure," which is stronger. Theirs
  still returns a number.

## What you have that it does not

Measurement. There is no evidence anywhere in that repository that its 22
patterns were ever run against a human baseline. The weights (2 to 5) have no
stated derivation. The threshold of 70 is, on this evidence, a number somebody
picked. Their `evals/cases.json` tests behavior, not rates.

Your project's whole argument is that you measured, published the rates, and
killed the findings that did not survive. That remains the differentiator, and
this repository is a good illustration of why it matters.

## Suggested next move

They accept issues and reproducible failure cases, and their CONTRIBUTING file
asks for exactly this. Filing the formatting-confound finding with the numbers
above would be a real contribution, it costs you an hour, and it puts
humansounding.com in the acknowledgments of the most credible peer project in
the category. That is a better link than any listicle.
