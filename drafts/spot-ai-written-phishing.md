# Can You Train Staff to Spot AI-Written Phishing?

**A measurement of fifteen AI-writing tells against 110,305 words of machine and human text, and what it means for security awareness programs.**

Gregg Westgate
Draft, 30 August 2026

---

## Summary for people who will not read the rest

Security awareness advice has started to include a new instruction: watch for writing that sounds like a machine. Em dashes. The word "delve." Sentences that contrast what a thing is not with what it is. The advice is spreading because it feels right, and because it is easy to put on a slide.

I built a tool that applies fifteen of those rules, then spent three weeks measuring whether they work. Fourteen of the fifteen do not separate machine writing from human writing. Four never fired at all across 110,305 words. Six fired fewer than seven times. Three fired more often in human writing than in some of the models. One is elevated in two models out of four, which makes it a habit rather than a signature.

Exactly one rule separated cleanly, and it identifies a single vendor's model rather than machine writing in general.

The security problem is worse than the accuracy problem. These tells are properties of default, unedited model output. An attacker who is running a targeted campaign is already removing them, because that is what every "make this sound human" tool on the market does. So the guidance catches the low-effort attacker, misses the competent one, and teaches staff that clean, tell-free prose is a sign of a human sender. That last part is the part that will get somebody phished.

I do not think style is a usable signal. Awareness programs should verify the channel and the claim instead, and the measurement behind that conclusion is below.

---

## Where this started

I built humansounding.com in August 2026, which is a site that flags AI-writing tells in a block of text you paste into it. The rules came from where everyone's rules come from: Wikipedia's editor guide, a few papers on word frequency in academic abstracts, some Reddit threads, and my own reading. I shipped it, wrote a post about it, and felt good.

Then it occurred to me that I had no idea whether any of it was true.

I had built a security tool, in effect, and I had never measured its false positive rate. Twenty years of telling other people not to buy products that cannot show their work, and I had shipped one. So I built a corpus and pointed my own rules at it, expecting to confirm most of them and retire one or two.

That is not what happened.

## What I measured

Six sets of documents, one document per file, nothing under 100 words.

| Set | Documents | Words |
|---|---|---|
| Claude Opus 5 | 40 | 21,814 |
| GPT-5.5 | 39 | 18,394 |
| ChatGPT | 35 | 10,914 |
| Gemini 3.7 Flash | 40 | 21,818 |
| Human, Medium articles 2018 to 2022 | 40 | 26,883 |
| Human, email newsletters, pre-2022 | 25 | 10,482 |

The machine sets were generated through vendor APIs against a recorded prompt list covering blog posts, cover letters, product recommendations and newsletters. The human sets predate ChatGPT, which is how I know a person wrote them. Rates are per 1,000 words with 95% bootstrap confidence intervals, and the bootstrap resamples whole documents rather than sentences, so one long quirky article cannot manufacture a tight interval.

Two things about the design matter more than the numbers.

The rules are parsed out of the live website at runtime instead of being copied into the study. If I change a regex on the site, the next run of the study changes with it, and the site can never quote a figure produced by a rule it no longer ships.

And the study reports a separation verdict only when both intervals sit clear of each other. No p-values, no accuracy scores, no classifier. A rate difference between two piles of documents says nothing about any individual document, and this work must never be cited as though it did. If the machine set fires a rule at nine per thousand words and the human set fires it at three, plenty of human writing still sits above nine.

## Result 1: fourteen of fifteen rules do not separate

Here is every rule in the checker, with what the corpus said about it.

**Four fired zero times in 110,305 words.** Inflated symbolism ("a testament to"), vague attribution ("experts say"), trailing participle analysis ("...underscoring its importance"), and chatbot artifacts ("Great question!"). All four are widely cited as AI tells. All four are real things models do. None of them happened often enough in this corpus to measure, which means none of them can carry a decision.

**Six fired, but barely.** Stock openers, one hit. Editorializing asides, one hit. Hedged balance, two. Fake-drama scaffolding, one. Fragment triplets, one. Summary phrases, six. Across every set combined. A rule that fires once in a hundred thousand words is not a detection method, whatever it is.

**Three fired often enough to compare, and overlapped human writing.**

| Rule | Highest model | Human, Medium | Human, newsletters |
|---|---|---|---|
| Negative parallelism | ChatGPT 0.55 [0.15, 1.05] | 0.22 [0.07, 0.43] | 0.10 [0.00, 0.33] |
| AI-favorite words | Gemini 1.01 [0.54, 1.53] | 0.33 [0.14, 0.56] | 0.57 [0.15, 1.30] |
| Rule of three | ChatGPT 0.46 [0.12, 0.92] | 0.11 [0.00, 0.24] | 0.10 [0.00, 0.31] |

Every one of those intervals touches a human interval. Negative parallelism deserves a particular note, because it is currently the most-cited AI tell anywhere, on the strength of a figure describing 2024-era ChatGPT. In the corpus measured here, one of the four models I tested uses it less often than the people in my human set do, and a second matches them exactly.

**One is elevated in two models.** Contrastive negation runs 1.90 in GPT-5.5 and 0.92 in Claude Opus 5, against 0.15 at most in either human set. That is a genuine gap. It is also shared, which makes it a family resemblance rather than a fingerprint. Gemini sits at 0.14, level with people. ChatGPT sits at 0.46, three times the human point rate, on an interval wide enough to overlap it. So the rule says something about two models, maybe something about a third, and nothing general about machines.

## Result 2: the one rule that works names a vendor

Em-dash density separated cleanly. Here is the whole table.

| Set | Em dashes per 1,000 words | 95% CI |
|---|---|---|
| Claude Opus 5 | 11.05 | [9.66, 12.53] |
| Human, Medium articles | 3.83 | [2.65, 5.08] |
| ChatGPT | 3.30 | [1.89, 4.88] |
| Gemini 3.7 Flash | 2.70 | [1.99, 3.45] |
| GPT-5.5 | 1.63 | [0.80, 2.81] |
| Human, newsletters | 1.05 | [0.20, 2.29] |

The rule counts em dashes and double hyphens together, which is how the site ships it. Counting true em dashes alone moves the Medium figure to 3.65 and the newsletter figure to 0.86 and changes no ordering.

Claude's interval clears every other set by a wide margin. Read that row alone and "em dashes mean AI" looks correct.

Read the rest of the column and it falls apart. Three of the four models tested emit em dashes at or below the rate of the human Medium articles. A reader applying the em-dash rule in 2026 is running a Claude detector, and a fairly good one, and it will stop working the moment Anthropic tunes the habit down. That has already happened once at another vendor: published figures put GPT-4.1 at 10.62 per thousand words and GPT-5.4 at 1.43.

A signal with a nine-month half-life cannot be the basis of an awareness program that gets refreshed annually.

## Result 3: there is no human baseline to train against

I have three sets of human documents now and they disagree with each other.

Casual 2004 blog posts contain no em dashes at all across 40 documents and 16,530 words. Medium articles run 3.83 per thousand words. Pre-2022 email newsletters run 1.05. The Medium and newsletter intervals do not overlap. These are all people, writing before the technology existed, differing from each other by more than most of the models differ from each other.

That has a direct operational consequence. You cannot set a threshold without knowing the genre, and an awareness program cannot condition on genre. The same em-dash density that is unremarkable in a long analyst note is unusual in a two-line internal request.

When I tested thresholds against the human Medium set, one em dash per 300 words flagged 18 of 40 genuine human articles. Loosening it to one per 200 flagged 13 of 40. That second line is the one the site ships, and it means roughly a third of real human long-form writing trips it.

Now look at what it catches. At one per 200, the same threshold flags 38 of 40 Claude documents and 56 of all 154 machine documents: 7 of 40 from Gemini, 7 of 39 from GPT-5.5, 4 of 35 from ChatGPT. So against three of the four models tested, a rule that trips on a third of genuine human long-form writing catches under a fifth of the machine writing it is aimed at.

Put that inside a company receiving thousands of legitimate messages a day and you have a report-suspicious-mail trigger that generates alerts your security team must triage, misses most of what it is for, and teaches everyone to ignore it.

The newsletter corpus, which is the closest thing I have to business email, sits low enough that the false positive rate there would be much smaller. That cuts against my own argument. It also proves the point about genre: the same rule behaves completely differently on two piles of human writing, and nobody deploying it gets to know in advance which pile they are looking at.

## Result 4: when a rule appears to work, check whether it is measuring the file format

I ran two third-party rule sets over the same corpora. Each contained a rule that looked like a strong separator, and in each case the rule was measuring how the documents were collected rather than who wrote them.

The first was a decorative-formatting rule, responsible for 74% of all findings that project produced. It fires only on markdown. My machine documents came out of an API as markdown; my human documents were scraped from web pages into plain text. One of 40 human documents contained a bold marker and none contained a markdown heading, against 26 to 40 of 40 in three of the four machine sets. The fourth, ChatGPT, contained none either, which is the other half of the point: the rule tracks how a given vendor's API formats its output, and it scores that vendor as human. The rule was a markdown detector wearing a costume.

The second was a curly-quote rule, and it ran backwards: humans 11.24 per thousand words, Claude 0.00. Scraped HTML preserves typographic quotes and API output uses straight ones. That rule separates Claude from people almost perfectly and separates nothing else, since GPT-5.5 sits at 9.73, within 14% of the human rate. Same artifact, different rule, different project, found on the same afternoon.

I filed the first as a bug on the maintainer's repository with the numbers attached. I also had to apply the check to myself, because my own human corpus is plain text and my own machine corpus is markdown, so any formatting-sensitive rule I ship carries the identical defect until I strip markup before comparing.

For what it is worth on the state of this field: I cloned five open-source AI-slop linters. The largest is 30 files, the wordiest is 13,381 words, and between them they contain zero measured documents. The rules are all somebody's impression, tested against synthetic strings written to make them pass.

## Why this matters for security specifically

Everything above is a measurement argument. Here is the security argument, and I hold it more strongly than I hold any single number above.

**The tells are a property of lazy output.** They show up in default, unedited, first-draft model text. There is now a whole product category devoted to removing them, and I have measured several of those products. An attacker mounting a targeted campaign against your finance team is not sending unedited output. He is sending something he has run through one of those tools, or through a prompt like the one I published for free on my own site. The tells survive in bulk spam, which your gateway was already catching on other grounds.

**So the guidance selects for the wrong attacker.** It gives staff a technique that works on the threat they were already surviving and fails on the one that will actually take money out of the account.

**And it inverts.** This is the part that concerns me. If you teach a person that machine-written mail contains em dashes and the word "delve," you have also taught them that mail without those things was written by a human. That inference is false and it runs in the dangerous direction. The most carefully written message in somebody's inbox is now the most trusted one, at a moment when careful writing has become free and unlimited. Before 2022, poor spelling was a usable heuristic partly because effort was expensive. Effort is no longer expensive, and any awareness program still trading on prose quality as a proxy for legitimacy is running on a dead assumption.

**None of the tells answer the question that matters.** Whether a machine assembled the sentences is not the security question. The security question is whether the sender is who the message says, and whether the request is one the real sender would make. A colleague drafting a legitimate request with AI assistance is now common and harmless. An attacker writing beautiful prose by hand is unaffected by every rule in this paper.

## What I would put in an awareness program instead

Verify the channel the request arrived on. A request that moves money or credentials gets confirmed on a path the sender did not choose: a known phone number, an internal directory entry, a Teams message to an account you already trust. That control works whoever or whatever wrote the mail, and it does not decay when a vendor retunes a model.

Teach the request shapes rather than the sentence shapes. Urgency plus secrecy plus a payment change is the pattern, and it has been the pattern for a decade. It survives the arrival of fluent attackers completely intact.

Remove writing quality from the reporting criteria entirely. If your phishing report button's guidance mentions tone, awkward phrasing, or "sounds like a robot," it is teaching an inference that no longer holds, and it is generating alerts your security team has to triage.

Say out loud that AI-assisted mail from real colleagues is normal now. Staff who believe machine-written text is inherently suspicious will report their own coworkers, and the volume of that will bury the real reports.

If you want a detection control for machine-generated text, buy a stylometric classifier and evaluate it on your own mail, with a measured false positive rate, the way you would evaluate any other control. Do not put a word list in a training deck and call it a control.

## Limits, and what would change my mind

My human corpora are blog posts, Medium articles and marketing newsletters. **None of them are phishing emails, and none are business correspondence.** I do not have a corpus of real attacker-written mail, and I would not be able to publish it if I did. The claim I can defend is that these tells fail to separate machine from human writing in the genres I measured, and that I see no mechanism by which they would do better in email. That is an argument from the measurements plus reasoning, and the reasoning half is not measured.

Author identities in the Medium set were not recorded. Circumstantially it looks like 35 to 40 distinct people across 40 documents, judging by the range of subjects, but that is an impression and not a record. I found a defect in my own collection script that let one source file contribute more than the intended two documents on the path the Medium set used, and I have not yet fixed it.

Forty documents is enough for a three-fold gap and not enough for decimal places. Splitting the human set into random halves, the halves disagree on the em-dash rate by about one per thousand words, against a full-set rate of 3.65. The directions are the finding. The decimals are not.

Four models is a small slice of what exists, and all four were tested in one week of one month.

What would change my mind: a rule that separates machine from human writing across at least three vendors, holds after markup is stripped from the machine and human sets alike, and survives on a human corpus in the same genre as the machine one. I have not found one. Contrastive negation is the closest candidate and it fails the three-vendor test.

## Reproducing this

The rules, the measured rates and the confidence intervals are published as JSON at humansounding.com/rules.json, regenerated weekly from the live checker. The study apparatus is in the repository at github.com/wyvernkalyx/humansounding under `study/`, including the generator, the prompt manifest and the measurement script. The 416 machine-written documents are public. The human documents are not redistributable, so a derived baseline of per-document rule counts and word counts is the next thing I am publishing, which will let anyone reproduce the human comparisons without me handing out other people's prose.

If you find a rule I have got wrong, the numbers are all there to argue with.
