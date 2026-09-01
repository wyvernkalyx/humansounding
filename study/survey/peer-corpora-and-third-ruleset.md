# Is there a corpus in that repo? No. Nor in any of them.

2026-08-29, in answer to: does prose-humanizer test against a corpus, and should
we download it.

## The direct answer

**No corpus. Nothing to download.**

The whole repository is 4,722 words of prose, all of it documentation. What
looks like test data is not:

- `evals/cases.json` is **six hand-written scenarios** with `must` and
  `must_not` assertions. No documents, no reference outputs, no scores. It tests
  whether the skill refuses to invent a quotation, not what its rules measure.
- `tests/prose-lint.test.js` is 248 lines of unit tests built on one-line
  synthetic strings written to trip specific regexes: *"This pivotal update
  serves as a testament to our progress."* That is a regex fixture, not prose.

So the observation in my evaluation was right and is now confirmed rather than
inferred: **there is no evidence those 22 patterns were ever run against a
human baseline, because the repository contains nothing to run them against.**

## I checked the other four too

prose-humanizer credits four peer projects in ACKNOWLEDGMENTS. I cloned all
four. Total words in each repository, documentation and code included:

| project | files | total words | corpus |
|---|---|---|---|
| blader/humanizer | 9 | 8,074 | none |
| petergyang/no-ai-slop | 13 | 9,239 | none |
| aashaexo/soundshuman | 21 | 13,381 | none |
| jalaalrd/anti-ai-slop-writing | 4 | 1,987 | none |
| amanmaqsood/prose-humanizer | 30 | 4,722 | none |

Five projects. Zero measured documents between them.

That is worth sitting with. The entire visible open-source ecosystem around
AI-writing tells consists of rule lists written from impression, and 416 public
documents, all of which are ours. The differentiator is not that we measure
better. It is that we are the only ones measuring.

## What I found instead: a third ruleset, and it replicates

soundshuman ships `bin/sloplint.js`, a second zero-dependency Node linter with
its own machine-readable rules. Safe to run: requires only `fs` and `path`, no
child_process, no network, one `writeFileSync` behind `fix -w`. So I ran it over
the same five corpora. Rates per 1,000 words:

| rule | Human | Claude | Gemini | ChatGPT | GPT-5.5 |
|---|---|---|---|---|---|
| em-dash | 4.17 | **12.20** | 4.16 | 3.55 | 2.06 |
| negative-parallelism | **0.30** | 0.05 | 0.19 | 0.09 | 0.23 |
| curly-double-quotes | **11.24** | 0.00 | 3.19 | 4.08 | 9.73 |
| emoji | 0.30 | 0.14 | **3.77** | 0.00 | 0.51 |
| oxford-triple | 0.79 | 1.57 | 2.56 | 4.35 | 4.46 |
| **TOTAL, all rules** | **18.00** | 14.48 | 16.53 | 12.43 | 18.08 |
| median composite score | 35 | 37 | 47 | 30 | 32 |

**Em dashes: third independent replication.** Claude 12.20 against human 4.17,
roughly 2.9x, with Gemini, ChatGPT and GPT-5.5 all at or below the human rate.
That is now three rulesets, written by three people who have never spoken to
each other, landing on the same answer.

**Negative parallelism: third independent replication that it is a dud.** The
human rate is the highest of all five sets. Again.

**Their whole ruleset does not separate humans from machines.** Total 18.00 for
humans, above Claude, Gemini and ChatGPT, and level with GPT-5.5. Their README
says "Score under 25 is the target"; the median human article scores 35.

**`curly-double-quotes` runs backwards, and it is the same confound as
prose-humanizer's.** Humans 11.24, Claude 0.00. Scraped HTML preserves curly
quotes; text written to a file by an API arrives with straight ones. That is the
second format artifact I have found in a third-party ruleset today, in a
different rule, in a different project. The rule's own note calls it a "weak
signal," which is fair, but it is not weak, it is inverted.

## One candidate general tell, and it does not survive the genre check

`oxford-triple` is the only rule in any of the three rulesets that separates all
four models from humans in the same direction. It matches
`\b\w+, \w+, and \w+\b`, a three-item list with a serial comma.

Two things are tangled in it.

**One: it is partly measuring the serial comma, not the rule of three.**
Counting both punctuations:

| set | A, B, and C | A, B and C | serial comma used |
|---|---|---|---|
| Human (Medium) | 21 | 14 | 60% |
| Claude Opus 5 | 34 | 1 | 97% |
| Gemini Flash | 53 | 1 | 98% |
| ChatGPT (chat) | 49 | 0 | 100% |
| GPT-5.5 | 78 | 4 | 95% |

Humans split 60/40 on the serial comma. Models use it essentially always. A rule
that only matches the serial-comma form therefore overstates the model rate by
about 40 percent of the human count. Worth flagging for us specifically: you use
Oxford commas, and the trends robot contract now requires them, so a rule keyed
this way would flag your own house style.

**Two: what is left is mostly genre.** Counting both forms, aggregate rates
looked like a real effect: human 1.30, Claude 1.60, Gemini 2.48, ChatGPT 4.32,
GPT-5.5 4.44. Then per genre, GPT-5.5:

| genre | words | per 1k |
|---|---|---|
| recommendation | 1,467 | 10.91 |
| linkedin | 860 | 10.47 |
| internal_memo | 1,301 | 9.22 |
| cover_letter | 1,189 | 8.41 |
| blog_post | 5,824 | 2.75 |
| newsletter | 6,082 | 1.81 |

Three-item lists cluster in short documents, and our human set is entirely
long-form. Restricting every model to blog posts and newsletters:

| set | words | per 1,000 |
|---|---|---|
| Human (Medium) | 26,883 | 1.30 |
| Claude Opus 5 | 5,441 | 1.10 |
| Gemini Flash | 7,800 | 1.67 |
| ChatGPT (chat) | 6,696 | 2.39 |
| GPT-5.5 | 11,906 | 2.27 |

The effect drops from 3.3x to 1.8x, Claude falls below the human rate, and the
model cells are 5,000 to 12,000 words each with no intervals. This is the
contrastive-negation story happening again, in a rule somebody else wrote,
caught by the same check. It is a candidate, not a finding, and it belongs in
the notebook rather than the checker.

## So: should we download anything?

Nothing exists to download. The reverse trade is the one on the table. Our 416
public AI documents are the only corpus in this ecosystem, and three separate
rule packs have now been run against them in an afternoon. Publishing the human
arm is not possible for copyright reasons, but publishing a **derived** human
baseline is: per-document rule counts and word counts, no text. That would let
anyone reproduce every comparison in the study without us redistributing a word
of anybody else's writing.

That, plus the rules as JSON, would make ours the reference dataset the others
get measured against.
