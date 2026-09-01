// PROPOSED, not yet run. Prompt set for the absence study (task #57).
//
// Written for a first-person sensory metric that did not survive its own audit
// the same afternoon: recomputed per document rather than pooled, human Medium
// fell from 5.4% to 1.7% and landed inside the machine range, and widening the
// hand-picked verb list collapsed every arm to 12-19% with no pattern. That
// metric measured casual-narrative register, not authorship. It is dead and
// nothing here should be read as support for it.
//
// The PROMPTS outlive it, because the register problem they were built for is
// real and unrelated. Sarcasm sits at 0.09 per 1,000 words in Claude and 0.10 in
// human Medium, which is the instrument failing to reach the register the same
// way the ritual-pushback pilot returned 0.00 across 116,353 words on
// 2026-08-27. Exclamation marks are the surviving absence candidate, human
// corpora 3.41 to 7.58 against machines 0.04 to 2.12, and testing it needs a
// human-comparable personal register too. This set reaches that register without
// naming any behavior.
//
// The matched human arm is `study/corpus/human`, the Blog Authorship Corpus,
// blogger.com, August 2004. Undirected personal blogging, eighteen years before
// ChatGPT. It is the only human corpus we hold that shows either behavior:
// sarcasm cues 2.13 against 1.00 for Medium, sensory first person 5.6%.
//
// ---------------------------------------------------------------------------
// WHAT THESE PROMPTS DO AND DO NOT PLANT
//
// They plant FIRST PERSON, deliberately. That is the controlled variable, not
// the measurement. We are not asking how often a model writes "I"; the existing
// corpora already answered that and the answer is that it writes it about as
// often as people do. We are asking what the "I" is attached to.
//
// They plant NOTHING about tone, attitude, sensory detail, sarcasm, humor,
// length or style. No prompt says vivid, funny, personal, honest or specific.
// A prompt that said "be vivid" would measure the instruction, which is the
// standing rule this repository enforces in study/prompts.mjs.
//
// Valence is balanced inside every set: four situations a person would plausibly
// be annoyed by, four they would not. Without that balance the run would only
// establish that annoying topics produce annoyed prose. The comparison that
// matters is within-arm across valence, and between arms within valence.
//
// ---------------------------------------------------------------------------
// THE ASYMMETRY TO STATE IN ANY WRITE-UP
//
// The 2004 bloggers were not prompted. They wrote undirected, about days they
// actually had. The model is answering a prompt about a day it did not have, so
// it must invent the experience.
//
// That does not invalidate the comparison, but it changes what the comparison
// claims. The question is not "does the model remember a body". It is: given the
// same task, does invented first-person experience carry the sensory and tonal
// marks that recounted experience carries? A model that fabricates a Tuesday
// convincingly is the interesting result, and so is one that cannot.
//
// Restrict the human side to the on-topic subset of the 2004 arm rather than all
// 40 documents, and say how many were kept.

export const EXPERIENCE_GENRES = [
  {
    id: "everyday_mishap",
    prompts: [
      "Write a blog post about the day my car wouldn't start.",
      "Write a blog post about a package that arrived three weeks late.",
      "Write a blog post about locking myself out of the house.",
      "Write a blog post about a haircut that went wrong.",
      "Write a blog post about the morning everything went right for once.",
      "Write a blog post about finding forty dollars in an old coat.",
      "Write a blog post about a repair that turned out to be easier than I expected.",
      "Write a blog post about the first warm day of spring.",
    ],
  },
  {
    id: "institutions",
    prompts: [
      "Write a blog post about renewing my driver's license at the DMV.",
      "Write a blog post about an hour on hold with the cable company.",
      "Write a blog post about a meeting that got rescheduled four times.",
      "Write a blog post about an insurance claim I had to file twice.",
      "Write a blog post about a permit that came through faster than expected.",
      "Write a blog post about a helpful person at the bank.",
      "Write a blog post about jury duty.",
      "Write a blog post about moving apartments.",
    ],
  },
  {
    id: "a_place_i_went",
    prompts: [
      "Write a blog post about a hospital waiting room.",
      "Write a blog post about my first time in a big city train station.",
      "Write a blog post about a long flight.",
      "Write a blog post about the county fair.",
      "Write a blog post about a diner I stopped at on a road trip.",
      "Write a blog post about walking around my neighborhood at night.",
      "Write a blog post about a concert I went to.",
      "Write a blog post about a hardware store I like.",
    ],
  },
  {
    id: "people",
    prompts: [
      "Write a blog post about a neighbor who plays music too loud.",
      "Write a blog post about a coworker who never replies to email.",
      "Write a blog post about an argument with my brother.",
      "Write a blog post about running into an old classmate at the grocery store.",
      "Write a blog post about teaching someone to drive.",
      "Write a blog post about my grandmother's cooking.",
      "Write a blog post about a stranger who helped me.",
      "Write a blog post about the person who cuts my hair.",
    ],
  },
  {
    id: "things_i_own",
    prompts: [
      "Write a blog post about a gadget that broke in the first week.",
      "Write a blog post about a printer that never works.",
      "Write a blog post about software that updated and got worse.",
      "Write a blog post about a phone I refuse to upgrade.",
      "Write a blog post about a pair of boots I've had for ten years.",
      "Write a blog post about my first car.",
      "Write a blog post about a kitchen knife I use every day.",
      "Write a blog post about a chair I found on the curb.",
    ],
  },
  {
    id: "time_and_routine",
    prompts: [
      "Write a blog post about a week when I got no sleep.",
      "Write a blog post about the last day of a job.",
      "Write a blog post about the night before a big day.",
      "Write a blog post about a rainy afternoon.",
      "Write a blog post about what I did last Saturday.",
      "Write a blog post about my morning before work.",
      "Write a blog post about cooking dinner on a weeknight.",
      "Write a blog post about a walk I take every day.",
    ],
  },
];

// Valence is recorded rather than inferred, because "annoyed by a rainy
// afternoon" is a judgment call and the analysis must not make it after seeing
// the output. Index within each set: 0-3 negative, 4-7 neutral or positive.
export const NEGATIVE_VALENCE_INDEX = [0, 1, 2, 3];
