# The corpus study

The trends page reports rates like "delve runs at 28x its expected frequency."
Every one of those numbers comes from somebody else's paper. This directory is
the apparatus for producing our own, for the rules where no paper exists.

Right now that is most of them. The four rules added in August 2026, and the
contrastive-negation rule in particular, are documented as anecdotal because
they came from reading Reddit threads and one newsletter. That is an honest
label and a weak one. This study is how a row moves from anecdotal to measured.

## What it does and does not claim

It measures how often each checker rule fires in machine-written text compared
to human-written text, per 1,000 words, with a confidence interval.

It does not detect anything. A rate difference between two corpora says nothing
about any individual document, and this study must never be cited as though it
did. If the AI arm fires a rule at 9 per 1,000 words and the human arm fires it
at 3, plenty of human writing still sits above 9. That is why the checker
reports tells and not verdicts, and why the trends page carries confidence
labels instead of scores.

## The design

**Two arms.** `corpus/ai/` and `corpus/human/`. One document per `.txt` file.
Documents under 100 words are ignored, because a rate per 1,000 words computed
from 60 words is noise with a decimal point.

**The unit of independence is the document, not the sentence.** A 2,000-word
article is one observation. The bootstrap resamples documents, which is what
keeps a single long, quirky piece from manufacturing a tight interval.

**Rules are parsed out of `checker.html` at runtime.** They are not copied here.
If a regex on the site changes, the next run of this study changes with it, and
the site can never quote a number produced by a rule it no longer ships.

**The verdict is suppressed below 20 documents per arm.** A bootstrap over four
documents produces a tight interval and a confident answer, and both are
artefacts of the sample size. The script prints rates at any N and prints a
separation verdict only above the bar.

**The only claim the design supports is non-overlapping 95% intervals.** No
p-values, no effect sizes, no classifier accuracy. Reaching for any of those
would require a design this is not.

## The AI arm

`generate.mjs` calls the API and writes one file per prompt, with a
`MANIFEST.tsv` recording model, genre, word count and the exact prompt.

Put the key in `.env` at the repository root once, and every script here picks
it up. `.env` is gitignored; `.env.example` shows the shape.

```
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# edit .env, paste the key after ANTHROPIC_API_KEY=
node study/generate.mjs --n 5
```

A key already in the environment always beats the file, so GitHub Actions
secrets are unaffected.

Eight genres chosen to match what visitors actually paste: LinkedIn posts,
cover letters, newsletters, marketing emails, blog posts, internal memos,
product updates, recommendation letters and reviews. Five prompts per genre is
40 documents, roughly 20,000 words, and costs a few cents.

The rule the generator exists to enforce: **the prompts never mention style.**
They do not say "sound natural" and they do not say "write like AI." They ask
for writing the way a person in a hurry asks for writing. If the prompt shapes
the prose, the study measures the prompt. What we want is the default register,
because the default register is what lands in somebody's inbox.

Length is the one format instruction, because unprompted length varies enough
to add more noise to a per-1,000-word rate than the effect being measured.

**Run more than one vendor.** A set drawn from a single model answers "does
this model still write like that", not "does AI writing still look like that".
The August 2026 Claude-only run found the delve/meticulous vocabulary almost
extinct at 0.09 hits per 1,000 words, while the live site's own tell counts had
that same rule firing on real visitor pastes more often than anything except em
dashes. Both are true. Visitors do not paste one vendor.

```
node study/generate.mjs --n 5 --out study/corpus/ai-claude
node study/generate.mjs --n 5 --vendor openai --model <id> --out study/corpus/ai-openai
node study/generate.mjs --n 5 --vendor gemini --model <id> --out study/corpus/ai-gemini
```

Anthropic picks its own newest model. OpenAI and Gemini require `--model`, and
running without it prints the ids available on your key. That is deliberate:
model names change faster than this file does, and silently guessing wrong
would put a mislabelled corpus into the study.

Keep each vendor in its own directory. One blended AI set averages away exactly
the between-vendor difference you are running this to find. Anything published
from a single-vendor run should name that vendor in the sentence.

## The human arm

This is the hard half, and it is worth being blunt about why.

Since late 2022 there is no such thing as text that is human by default. Any
sample pulled off the open web today might be machine-written or
machine-edited, and if contaminated human text drifts toward the AI arm, every
rate difference shrinks and the study quietly understates its own effects.

Three sources, in descending order of how much they can be trusted:

**1. Perfect provenance, small.** Gregg's own Medium and blog writing from 2022
and 2023, plus anything else with a timestamp before ChatGPT and a known
author. Small, but there is no doubt about it. His own posts have the extra
virtue that the rules do not spare their author: the contrastive-negation rule
fires once on his own Medium prose, correctly.

**2. Pre-2022 published prose.** Anything with a publication date before
November 2022 is known-human by date. Plentiful. The catch is register: a 2015
magazine feature is professionally edited, and comparing edited feature writing
to a model's first draft measures editing as much as it measures the model. If
the human arm is drawn from here, it should be drawn from the same genres as
the AI arm: pre-2022 LinkedIn posts, pre-2022 marketing emails, pre-2022
internal memos.

**3. Solicited writing.** Ask people to write 500 words on a prompt, with a
promise not to publish it and not to name them. Perfect provenance and matched
register, at the cost of being slow to collect.

Do not build this arm by finding text you suspect is AI and sorting it. That
turns the study into a measurement of your own intuition, which is the thing
the study is supposed to test.

`collect-human.mjs` turns a downloaded research corpus into study documents. It
fetches nothing: you download the corpus, it extracts, filters, samples and
records provenance.

```
node study/collect-human.mjs --in <folder> --format text|blogger|maildir \
  --label blogauthorship --date 2004 --why "why this is known human" --n 40
```

`--why` is required. It is the column that makes this a study rather than a
pile of text. The collector caps each source file at two documents so one
prolific author cannot dominate, drops near-duplicates, shuffles before
sampling so the corpus is not the alphabetical head of the archive, and strips
quoted replies from mail so a thread does not count as one author's prose.

Spot-check the output by eye. Extraction is the step where corpora quietly go
wrong, and no confidence interval will tell you it happened.

`corpus/human/MANIFEST.tsv` records where each document came from and why it is
known to be human. `measure.mjs` warns when an arm has no manifest, because a
number without provenance is a number and not evidence.

**Copyright.** Commit the AI arm, since it is our own generated output. Do not
commit third-party human text into this repository. Keep it locally, record the
source in the manifest, and publish the rates rather than the corpus. The
`.gitignore` enforces this by ignoring `study/corpus/human/*.txt` outright; for
a document you own, override it deliberately with `git add -f`.

## Running it

```
node study/measure.mjs study/corpus/ai study/corpus/human
```

Prints a rate table per rule with 95% intervals, mean sentence-length
coefficient of variation per arm, a separation verdict if both arms clear 20
documents, and the whole thing as JSON on the last line.

## Publishing a result

A row on the trends page can be relabelled from anecdotal to measured when all
of these are true:

- Both arms have 20 or more documents with recorded provenance.
- The intervals do not overlap.
- The method here is linked from the row, so the number is reproducible rather
  than asserted.
- The write-up states the vendor, the genres, the date and the checker commit,
  because a tell measured in August 2026 against one model is not a permanent
  fact. The whole premise of the site is that these things expire.

And if a rule measures out flat, say so and label it. A rule that fires equally
in both arms is a real finding about that rule, and reporting it is the only
thing that makes the rest of the table worth believing.
