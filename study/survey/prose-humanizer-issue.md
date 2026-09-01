**Title:** `decorative-formatting` separates markdown from plain text, not AI from human

---

I run [humansounding.com](https://humansounding.com), which catalogs AI-writing
tells and publishes rates rather than verdicts. I ran `prose-lint` over my
corpora to see how your patterns behave against a human baseline. Most of what I
found is a compliment. One thing looks like a bug in the measurement, and it is
the same mistake I made three weeks ago, so I wanted to write it up properly.

## Setup

456 documents, 203,788 words, `prose-lint analyze --json` on each, rates per
1,000 words.

- **Human baseline:** 40 Medium articles, roughly 27,600 words, published 2018
  to 2022 and so before ChatGPT existed. Sampled at random from a public
  pre-ChatGPT dataset and scraped as plain text. Author identities were not
  recorded, so I cannot tell you how many distinct writers are in there; the
  topics span forty unrelated subjects, but that is an impression and not a
  record. I am stating it because the main finding below does not depend on it.
- **AI sets:** 40 documents each from Claude Opus 5, Google's Gemini Flash, an OpenAI
  chat model, and GPT-5.5, across eight genres. Prompts never mention style.
  Written to files by API, so they arrive as markdown.

Corpus and method: https://github.com/wyvernkalyx/humansounding

## The finding

`decorative-formatting` produced **750 of 1,016 total findings** across all 456
documents. Rates per 1,000 words:

| rule | Human | Claude Opus 5 | Gemini Flash | ChatGPT | GPT-5.5 |
|---|---|---|---|---|---|
| decorative-formatting | 0.00 | 0.05 | **9.83** | 0.18 | 1.83 |
| dash-cluster | 0.51 | 1.69 | 0.10 | 0.62 | 0.00 |
| tier1-vocabulary | 0.29 | 0.19 | 1.03 | 0.18 | 0.23 |
| negative-parallelism | 0.18 | 0.00 | 0.05 | 0.09 | 0.17 |
| **TOTAL** | **1.52** | **1.97** | **11.24** | **1.06** | **2.46** |
| **TOTAL minus decorative-formatting** | **1.52** | **1.92** | **1.42** | **0.89** | **0.63** |
| words | 27,648 | 21,360 | 20,458 | 11,293 | 17,502 |

The pattern that fires is
`^\s*[-*]\s+\*\*[^*]+:\*\*` — a markdown bullet carrying a bolded label.

My human corpus contains `**` in 1 of 40 documents and a markdown heading in 0 of
40. The AI corpora contain `**` in 36 of 40 (Claude), 40 of 40 (Gemini), and 26
of 40 (GPT-5.5).

So the rule cannot fire on the human set for a reason that has nothing to do
with writing. It is measuring the file format the text was stored in, not the
prose. Note that this holds however many people wrote those 40 articles: it is a
fact about scraping HTML to plain text, not a fact about authors.

Remove the rule and every model lands at or below the human rate; Gemini drops
from 7.4x human to 0.9x.

To be clear about scope: the bolded-label bullet is a real habit and worth
flagging. The problem is only that its rate is not comparable between a markdown
source and a plain-text one, and the score mixes it in with prose rules that are.

I hit the same class of error in my own study. I had a contrastive-negation
result at 12x the human rate that turned out to be entirely genre and length:
all the hits were in the two long genres, and my human set was all long-form.
Killing it was the most useful thing I did that week.

**Suggestion:** either separate the `format` category from the prose categories
in `score`, or note in the README that scores are only comparable between
documents of the same markup convention. A `--no-format` flag would do it.

## Three smaller observations from the same run

**Seven of 22 patterns never fired once in 203,788 words:**
`significance-inflation`, `copula-avoidance`, `fake-alternative`,
`aphorism-formula`, `prompt-echo`, `chatbot-artifact`, `knowledge-disclaimer`.

Nine of my own fifteen launch rules did the same thing, for the same reason:
they describe how models wrote in 2023 and 2024, and the labs tuned that
behavior out. `chatbot-artifact` and `knowledge-disclaimer` are the "As an AI
language model" family, which is gone. Three patterns account for 95 percent of
all findings.

**The default CI threshold cannot fire.** The pre-commit hook and
`scan --fail-above` default to 70. The highest score any of the 456 documents
reached was 44, and that includes the markdown-heavy Gemini set. A gate at 70
passes everything.

**`references/patterns.md` scores 100**, because it quotes the patterns it
documents. `prose-lint scan docs/` over a repository that documents writing style
will flag its own documentation first.

## Where your rules agree with mine

Worth saying, because it is the more interesting half. Three findings from my own
study reproduce under your rule definitions, which were written by a different
person from different sources. I have stated the first two between models, where
no human baseline is involved at all:

- **`tier1-vocabulary` is a Gemini habit, not a general one.** Gemini 1.03,
  against 0.19 for Claude, 0.18 for the OpenAI chat model and 0.23 for GPT-5.5.
  Four to five times every other model. My own, differently chosen word list gave
  the same shape.
- **`dash-cluster` is a Claude habit.** Claude 1.69, ChatGPT 0.62, Gemini 0.10,
  and GPT-5.5 does not do it once in 17,502 words. Your rule matches paired
  dashes within a line rather than density, and it still lands where my density
  measure did.
- **Negative parallelism is a weak tell.** Human 0.18, GPT-5.5 0.17, ChatGPT
  0.09, Gemini 0.05, Claude 0.00. This one does use the human baseline, and the
  human rate is the highest of the five, so if my baseline is off the rule looks
  better than it deserves rather than worse.

Two rulesets built independently landing on the same three conclusions is a
better result than either one alone, and it is the reason I bothered writing
this up rather than just filing the bug.

Happy to share the per-document JSON if it is useful.
