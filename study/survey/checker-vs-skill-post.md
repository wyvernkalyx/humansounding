# Why do AI-writing checkers miss the most obvious AI writing?

Last week I filed a bug report on somebody else's open-source project. Before
sending it I ran the draft through my own checker, which seemed like the least I
could do given what this site is for. Zero hits in 933 words.

Then I read it again and found three sentences that were obviously AI-written.

All three broke the same rule, and all three were problems with what the phrasing
was doing rather than with any word in it. One read: "Worth saying, because it is
the more interesting half."

The name for it is self-narration: writing about the writing instead of about
the subject. Models qualify the worth of what they are about to say, and people
do that far less often. Cut the sentence and the reader loses no fact about the
subject, which is the test.

A person catches that in a second. Code has nothing to grab. Every word in the
sentence is ordinary English, and the fault lives in the job it is doing.

## What a checker can hold

Every rule on this site is a regular expression. That is not a limitation I
apologize for; it is what makes the checker fast, private, and honest. Nothing
leaves your browser, the rule that fired is printed next to the sentence that
fired it, and you can read the source and see exactly why.

Regular expressions are good at things with edges. An em dash is a character.
A word on the ban list is a word. "It's not just X, it's Y" is a shape you can write
down. Rules like these can be counted, and once you can count a rule you can
measure it against human writing and find out whether it means anything. That is
most of what I have published here.

Self-narration has no edges. It is rule 13 in the [instruction
file](/fix-your-ai.html), and deliberately not in the checker.

## The rule I could not count

Self-narration has six forms.

1. Rating your own confidence
2. Announcing your integrity
3. Apologizing for an earlier draft
4. Describing the document's own body
5. Telling the reader how much something matters
6. Reviewing a source's prose rather than reporting what it said

When I first proposed the rule I did what I now do with every rule, and measured
it before shipping it. Across all nine corpora, 456 model documents and 80 human
documents, it fired almost nowhere. Between 0.00 and 0.14 hits per thousand
words, and one of the six forms ran higher in the human sets than in three of the
four models. On that evidence it could not go in the checker. It went in the
instruction file instead.

The zeros bothered me, because the behavior is obviously real.

## Self-narration shows up when you correct the model

It is almost absent from a first draft. It appears the moment you tell a model it
got something wrong.

Every document in my study was a single fresh answer to a prompt nobody had
argued with, which is why the rule fired nowhere. So I built the corpus that was
missing. Fifteen sessions, each one a writing task, a draft, a specific
correction from me, and then the model's reply. Two of the five corrections were
factual, the kind where it had invented a number or reversed a cause. The reply
is the measured document, including whatever the model says alongside the fixed
draft, because that is where the behavior lives.

Self-narration in single-turn writing: 0.00 to 0.14 per thousand words.

Self-narration in post-correction replies: 14.3 to 19.9.

Two orders of magnitude, and it explains the zeros. The rule was never wrong. I
had been looking for it in the one place it does not occur.

## Then the regexes failed

I wrote six regular expressions for those fifteen documents, one per form, built
from real examples. I validated them first: thirteen hand-picked positive
sentences, all thirteen caught. Twelve ordinary sentences that should not fire, none of them did.

Run against the fifteen new documents, those regexes found nothing. A careful
reader working from the same six definitions found thirty-seven instances in
2,208 words.

Here is what the reader was catching. "Right." "Fair." "Fixed:" "Good catch."
"Try this:" "Shorter:" "Here's the plainer version." "dialed back the
victory-lap tone."

There is no pattern there. Every one of those is ordinary English doing ordinary
work in some other sentence, and any regular expression loose enough to catch
them would flag half of everything anyone writes. The forms are unbounded. That
is the whole problem, and no amount of work on my part fixes it.

## The checker and the instruction file do different jobs

This site ships two things. The checker is the box on humansounding.com where you
paste a draft and it highlights the AI-writing tells. The [instruction
file](/fix-your-ai.html) is a page of rules you hand to a model before it writes,
so the draft comes out cleaner to begin with.

A tell belongs in the checker when its surface forms are bounded. Em dashes,
watched vocabulary, contrastive negation, stock openers: finite shapes, countable,
measurable against a human baseline, safe to show a stranger with a number
attached.

A tell belongs in the instruction file when the forms are open. Self-narration,
telling the reader what matters, announcing your own honesty. These need somebody
to read the sentence and ask what it is for. A person can do that in a second. A
pattern matcher cannot do it at all.

The dividing line is not how bad the tell is. Self-narration may be the most
recognizable habit in the whole catalog, and it will never be in the checker.

## The fix that did not work

I thought I had an easy improvement. Rule 13 already explains the mechanism, in
a sentence buried in the middle of it: AI prose addresses an evaluator, and human
prose addresses a reader who is not grading you. Promote that to a framing
statement at the top of the instruction file, ahead of every rule, and the model would
carry it into everything it wrote.

I generated the fifteen sessions three ways. No instruction file. The file as it
ships. The file with the new framing section on top. A separate model scored all forty-five
documents blind, with the files shuffled and renamed so it could not tell which
condition it was reading.

No instruction file: 14.3 per thousand words. The file as it ships: 16.5. The
file with the framing line: 19.9.

Five documents per condition, so those differences are noise and I am not
claiming the framing line made anything worse. I am claiming there is no evidence
it helps, which is enough to keep it out of the instruction file.

The likely reason is that the diagnosis was right and the remedy did not follow
from it. The model is answering the person who just corrected it. At that moment
there really is an evaluator in the conversation, and telling it to imagine a
reader does not change who just spoke.

## What the instruction file did fix

One thing moved. Closing offers, the "let me know if" and the "Better?" that models tack onto a
reply, went from four in the control
to zero with the instruction file.

That is rule 12 working exactly as designed, because those are strings. The file
removes what it can name. It struggles with a move that can be made a hundred
ways.

## What changes here

Nothing in the checker. The rule stays out.

The instruction file gets a new candidate rule to test, and this one is bounded, which is
why I think it has a chance: when returning a revised draft, return the draft. No
acknowledgment of the correction, no summary of what changed, no characterization
of the previous version. That is an instruction with a shape, and I can measure
whether it works before it ships.

If you use a model to write, watch the reply that comes after you tell it that it
got something wrong. That is where the writing starts being about the writing, and it is the one thing this site's checker will
never catch for you.
