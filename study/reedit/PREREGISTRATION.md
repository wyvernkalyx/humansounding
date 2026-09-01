# Re-edit experiment: what we predict before we look

Written 2026-09-01, before the first run of `study/reedit.mjs`. Nothing in this
file may be edited after a run exists. Corrections go in a dated section at the
bottom with the reason.

## The question

The habitat study of 2026-08-28 measured self-narration at 0.00 to 0.14 per
1,000 words in single-turn replies and 14.3 to 19.9 in replies to a correction.
That is roughly a hundredfold difference and it is the finding on the site.

It says nothing about what happens on the second correction, or the third. Two
stories fit the existing data equally well. Either the behavior accumulates,
and a model corrected repeatedly narrates itself more each time, or it saturates,
and the first correction moves it to a plateau where it stays.

## The design

Three arms, thirty seed documents, three rounds.

- **C**, the seed reply. One turn. Round 0, shared by both arms.
- **A**, correction. The user attributes a fault, then asks for a change.
- **B**, neutral revision. The user asks for the same change, attributing no fault.

A and B branch from the same round-0 reply, so the arms are paired and every
difference between them is the follow-up. At each round the two arms send the
identical instruction behind clauses matched for length, one assigning blame to
the model and one not. Arm B is what makes this an experiment. Without it a rise
in arm A is equally consistent with "correction provokes self-narration" and
"any second turn provokes self-narration," and only the first is the published
claim.

## The predictions

1. **A exceeds C at round 1, by a lot.** This is the replication and it should
   land near the habitat study's numbers. If it does not, stop, because the
   instrument or the corpus is wrong and nothing after this matters.

2. **A exceeds B at every round.** This is the actual hypothesis. Predicted
   direction, no predicted size.

3. **B exceeds C.** Being asked to revise anything should produce some
   self-narration, well under arm A. If B comes back at C's floor, the effect
   belongs to the second turn rather than to the correction, and the site's
   framing needs to change.

4. **Accumulation: we predict saturation, not growth.** A round 2 and round 3
   that sit inside round 1's interval. Stated plainly so that a rising curve
   counts as a surprise and gets the scrutiny a surprise deserves. Gregg's
   hypothesis when he proposed this on 2026-09-01 was that the edited corpus
   would show *more*, so this prediction is the house taking the other side.

5. **The gap between A and B does not widen across rounds**, even if both rise.

## What would falsify each

Prediction 2 fails if the A and B intervals overlap at every round. Prediction 4
fails if round 3's interval clears round 1's upper bound. Prediction 3 fails if
B's interval includes C's point estimate.

## Rules fixed in advance

- Measure the **whole reply**, not the revised document. The self-narration sits
  in the framing around the document and a document-only measurement discards
  the text under test.
- Score with a **model, blind to the arm**. Not the checker. Its regexes found 0
  of the 37 instances a human reader found in the habitat study.
- **Control for conversation length.** Round 3 carries more context than round 1,
  so accumulation is confounded with context length unless `ctx_words` enters the
  model. That column is in the manifest for this reason.
- Bootstrap CIs resampling **whole conversations**, not turns. Turns inside one
  conversation are not independent.
- The 100-word floor and the 20-document verdict floor apply as everywhere else.
- One model per run. A run that mixes models answers a different question.

## Cost

30 seeds x (1 + 2 arms x 3 rounds) = 210 calls, plus 210 scoring calls if the
scorer runs one document at a time.

---

## Amendment, 2026-09-01, before any scoring

Added after the run completed and before a single reply was scored. What was
looked at: reply word counts and context word counts from the manifest. No text
was read and the self-narration measure has not been computed.

**Reply length differs by arm, and the original design did not control for it.**
Median words per reply:

| | round 1 | round 2 | round 3 |
|---|---|---|---|
| arm A, correction | 321 | 156 | 217 |
| arm B, neutral revision | 516 | 260 | 272 |

Corrected, the model answers shorter. At every round, by a wide margin.

This breaks the planned measure. Self-narration was to be reported per 1,000
words. The framing that carries it, "you're right, I overstated that", is
roughly a fixed cost per reply rather than a quantity that scales with reply
length. A constant amount of it divided by a 40 percent shorter reply produces a
higher rate for arithmetic reasons alone, and arm A would appear elevated even if
the model narrated itself exactly as often in both arms.

**Amendment: report both.** Instances per 1,000 words, and instances per reply.
Prediction 2 requires arm A to exceed arm B on **both** measures. If the two
measures disagree, the honest report is that they disagree and the effect is
confounded with reply length, not that one of them is the answer.

Reply length also enters the accumulation question, since rounds 2 and 3 are
shorter than round 1 in both arms. Prediction 4, saturation, must be evaluated on
the per-reply measure, where a shrinking denominator cannot manufacture a rise.

Nothing else in this file changes. The predictions stand as written.
