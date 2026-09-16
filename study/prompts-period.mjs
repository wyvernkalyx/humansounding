// Period-anchored prompt sets for the perceived-axis study.
//
// Control 1 of the three in study/perceived/PREREGISTRATION.md, and the
// strongest of them. Every existing model arm writes timeless topics ("a
// newsletter issue about how to build a morning routine that sticks"), so era
// cues appear only on the human side of a comparison. A rater who spots an
// iPhone 6 is then scoring the date, not the prose, and the instrument measures
// period-reference spotting rather than AI-writing perception. That was Gregg's
// objection on 2026-09-03 and it is what these prompts exist to remove.
//
// TWO SETS, BECAUSE THE HUMAN SIDE IS TWO DIFFERENT DOCUMENTS.
//
// The preregistration stratifies the human passages, and the strata are not the
// same kind of writing:
//
//   Blog Authorship Corpus, August 2004 -- undirected personal blogging by
//   ordinary people. Read four at random and you get a diary entry about a busy
//   day, a fifteen-year-old in Mosul introducing her family, someone posting
//   photos of a flower and a frog, and a political rant. Mundane, first person,
//   no expertise claimed, frequently ungrammatical.
//
//   Substack, 2017 to 2022-11-30 (825 of 854 are 2021) -- domain experts
//   writing to a subscriber list. A naval affairs writer on the Afghanistan
//   withdrawal, an orthopedic surgeon on youth sports specialization, a climate
//   policy academic on a PNAS retraction.
//
// Prompting both with "write a blog post about X" would produce an article in
// each case, and the era control would then work while a REGISTER cue quietly
// replaced it. Genre has killed more findings in this project than anything
// else. So blog_2004 asks for a personal entry and newsletter_2021 asks for an
// expert issue, matched to the stratum each will be compared against.
//
// WHY THIS IS NOT A STYLE INSTRUCTION.
//
// prompts.mjs exists to enforce one rule: the prompts ask for writing the way a
// person actually asks for writing, and never mention style. These obey it.
// Naming the document ("an entry for my personal blog") and the situation ("it
// is August 2004") is the same kind of instruction as "a cover letter" -- it
// says what to write, not how to write it. Nothing here asks for a tone, a
// voice, a reading level, typos, or informality. If a future reader thinks
// otherwise, that is a real objection and it should be argued out rather than
// quietly patched.
//
// ANACHRONISMS ARE THE POINT, NOT A DEFECT.
//
// The preregistration requires model anachronisms to be logged as findings. A
// 2021 newsletter that mentions ChatGPT, or a 2004 blog entry that references a
// smartphone, is evidence about how well a model can be placed in a period at
// all. The AI-and-machine-learning prompt in the 2021 set is deliberately left
// in for that reason: 2021 is before ChatGPT's public launch, so it is the
// cleanest trap in the set.
//
// EXTENDED 2026-09-14: newsletter_2021 went from 40 prompts to 60.
//
// Why: the passage packet built on 2026-09-11 cleared every preregistered floor
// and still let a reader score 64.2% from register alone — 43 of 60 model
// passages were blog_2004 against 26 of 60 human, and only 17 model newsletters
// against 34 human Substack posts. Balancing the packet by register needs 34
// eligible model newsletters and only 26 existed.
//
// The shortfall is control 1 doing its job. A period-anchored 2021 newsletter
// names its year far more often than a 2004 diary entry does, so control 2 drops
// it far more often: model blog documents survive screening at 89%, model
// newsletters at 33%.
//
// THE DISCIPLINE THAT APPLIES TO PROMPTS 41-60, AND TO ANY ADDED LATER.
//
// Whoever adds prompts here after 2026-09-08 knows the yield is low and knows
// why. That makes it tempting to write prompts whose answers will avoid naming
// the year, which would raise the yield by quietly removing control 1 — the
// exact trade the screening note below forbids.
//
// So: prompts 41-60 open on the era in the same words as 1-40 and steer the
// model away from nothing. A lower survival rate on the new batch than the old
// one is the expected result and is not a reason to revise them. If the new
// batch survives NOTICEABLY BETTER than the original 40, treat that as evidence
// the spec drifted, not as a success.
//
// They were written before any of them had been generated or screened, and they
// have not been iterated on since.
//
// Screening note: study/perceived's control 2 drops any passage containing a
// four-digit year token, applied identically to both arms. Many documents
// generated from these prompts will say "2004" or "2021" outright and be
// dropped. Generate with that attrition in mind; do not "fix" it by removing
// the era from the prompt, which would remove control 1.

export const PERIOD_GENRES = [
  {
    id: "blog_2004",
    era: "2004",
    stratum: "blogauthorship",
    prompts: [
      "It is August 2004. Write an entry for my personal blog about staying up to watch the Olympics opening ceremony.",
      "It is August 2004. Write an entry for my personal blog about finally getting a Gmail invite from a friend.",
      "It is August 2004. Write an entry for my personal blog about my first week at a summer job.",
      "It is August 2004. Write an entry for my personal blog about the heat and our apartment having no air conditioning.",
      "It is August 2004. Write an entry for my personal blog about switching from dial-up to broadband at home.",
      "It is August 2004. Write an entry for my personal blog about my sister's wedding last weekend.",
      "It is August 2004. Write an entry for my personal blog about getting my exam results back.",
      "It is August 2004. Write an entry for my personal blog about buying a digital camera and the photos coming out wrong.",
      "It is August 2004. Write an entry for my personal blog about a road trip to see my grandparents.",
      "It is August 2004. Write an entry for my personal blog about the album I have had on repeat all month.",
      "It is August 2004. Write an entry for my personal blog about moving into my first apartment.",
      "It is August 2004. Write an entry for my personal blog about my cat getting out and coming back three days later.",
      "It is August 2004. Write an entry for my personal blog about a movie I saw at the theater this weekend.",
      "It is August 2004. Write an entry for my personal blog about failing my driving test.",
      "It is August 2004. Write an entry for my personal blog about starting my last year of high school.",
      "It is August 2004. Write an entry for my personal blog about my dad trying to teach me to fix the car.",
      "It is August 2004. Write an entry for my personal blog about a concert I went to.",
      "It is August 2004. Write an entry for my personal blog about the presidential campaign and the debates coming up.",
      "It is August 2004. Write an entry for my personal blog about a friend moving away.",
      "It is August 2004. Write an entry for my personal blog about burning a mix CD for someone.",
      "It is August 2004. Write an entry for my personal blog about my new phone that takes pictures.",
      "It is August 2004. Write an entry for my personal blog about a storm coming through and losing power for two days.",
      "It is August 2004. Write an entry for my personal blog about registering to vote for the first time.",
      "It is August 2004. Write an entry for my personal blog about an argument with my roommate about the dishes.",
      "It is August 2004. Write an entry for my personal blog about the book I just finished.",
      "It is August 2004. Write an entry for my personal blog about my first paycheck and what I spent it on.",
      "It is August 2004. Write an entry for my personal blog about a camping trip that went badly.",
      "It is August 2004. Write an entry for my personal blog about my little brother starting kindergarten.",
      "It is August 2004. Write an entry for my personal blog about trying to teach myself guitar.",
      "It is August 2004. Write an entry for my personal blog about a job interview that did not go well.",
      "It is August 2004. Write an entry for my personal blog about my computer dying and losing everything on it.",
      "It is August 2004. Write an entry for my personal blog about a family reunion at the lake.",
      "It is August 2004. Write an entry for my personal blog about the message board I joined and the people on it.",
      "It is August 2004. Write an entry for my personal blog about the diner I work at and the regulars.",
      "It is August 2004. Write an entry for my personal blog about my grandmother being in the hospital.",
      "It is August 2004. Write an entry for my personal blog about a video game I have been playing too much of.",
      "It is August 2004. Write an entry for my personal blog about the construction on my commute.",
      "It is August 2004. Write an entry for my personal blog about getting a puppy.",
      "It is August 2004. Write an entry for my personal blog about my summer ending and classes starting again.",
      "It is August 2004. Write an entry for my personal blog about a wedding I was not invited to.",
    ],
  },
  {
    id: "newsletter_2021",
    era: "2021",
    stratum: "substack",
    prompts: [
      "It is 2021. Write this week's issue of my newsletter on shipping and logistics, about the container backlog at the west coast ports.",
      "It is 2021. Write this week's issue of my newsletter on energy markets, about the Texas grid failure in February.",
      "It is 2021. Write this week's issue of my newsletter on semiconductors, about the chip shortage stopping car production lines.",
      "It is 2021. Write this week's issue of my newsletter on markets, about retail traders and the short squeeze in January.",
      "It is 2021. Write this week's issue of my newsletter on macroeconomics, about whether this inflation is transitory.",
      "It is 2021. Write this week's issue of my newsletter on housing, about bidding wars and how little inventory there is.",
      "It is 2021. Write this week's issue of my newsletter on public health, about the Delta variant and breakthrough infections.",
      "It is 2021. Write this week's issue of my newsletter on vaccine distribution, about cold chain logistics in rural counties.",
      "It is 2021. Write this week's issue of my newsletter on the future of work, about companies announcing permanent hybrid policies.",
      "It is 2021. Write this week's issue of my newsletter on labor economics, about the quit rate and why employers cannot fill roles.",
      "It is 2021. Write this week's issue of my newsletter on defense and foreign policy, about the withdrawal from Afghanistan.",
      "It is 2021. Write this week's issue of my newsletter on crypto, about what an NFT actually is and what people are buying.",
      "It is 2021. Write this week's issue of my newsletter on climate policy, about the new IPCC report.",
      "It is 2021. Write this week's issue of my newsletter on sports medicine, about single-sport specialization in young athletes.",
      "It is 2021. Write this week's issue of my newsletter for small business owners, about what happened after the relief loans ran out.",
      "It is 2021. Write this week's issue of my newsletter on commercial real estate, about offices that are still empty.",
      "It is 2021. Write this week's issue of my newsletter on education policy, about schools reopening and what districts got wrong.",
      "It is 2021. Write this week's issue of my newsletter on aviation, about demand returning faster than staffing.",
      "It is 2021. Write this week's issue of my newsletter on restaurants, about delivery apps and what they do to margins.",
      "It is 2021. Write this week's issue of my newsletter on the film business, about studios releasing to theaters and streaming the same day.",
      "It is 2021. Write this week's issue of my newsletter on geopolitics, about Taiwan and semiconductor manufacturing.",
      "It is 2021. Write this week's issue of my newsletter on construction, about lumber prices and what they did to homebuilders.",
      "It is 2021. Write this week's issue of my newsletter on the auto industry, about used cars costing more than new ones.",
      "It is 2021. Write this week's issue of my newsletter on infrastructure, about what is actually in the spending bill.",
      "It is 2021. Write this week's issue of my newsletter on adolescent psychology, about the research on social media and teenage girls.",
      "It is 2021. Write this week's issue of my newsletter on spaceflight, about private crewed launches and what they cost.",
      "It is 2021. Write this week's issue of my newsletter on cybersecurity, about the pipeline ransomware attack and what it exposed.",
      "It is 2021. Write this week's issue of my newsletter on operations, about companies rethinking just-in-time inventory.",
      "It is 2021. Write this week's issue of my newsletter on local government, about how counties are spending relief funds.",
      "It is 2021. Write this week's issue of my newsletter on venture capital, about the SPAC boom and who is left holding it.",
      "It is 2021. Write this week's issue of my newsletter on medicine, about whether telehealth survives once the surge ends.",
      "It is 2021. Write this week's issue of my newsletter on agriculture, about the drought in the west and this year's yields.",
      "It is 2021. Write this week's issue of my newsletter on the music business, about touring restarting and what it costs now.",
      "It is 2021. Write this week's issue of my newsletter on journalism, about whether paid newsletters are a real business.",
      "It is 2021. Write this week's issue of my newsletter on urban policy, about outdoor dining becoming permanent.",
      "It is 2021. Write this week's issue of my newsletter on e-commerce, about shipping costs for small sellers.",
      "It is 2021. Write this week's issue of my newsletter on nursing, about staffing shortages and what hospitals are paying travelers.",
      "It is 2021. Write this week's issue of my newsletter on machine learning, about what large language models can and cannot do yet.",
      "It is 2021. Write this week's issue of my newsletter on retail, about store closures and where the sales actually went.",
      "It is 2021. Write this week's issue of my newsletter on refining, about why gasoline prices moved the way they did this year.",

      // --- added 2026-09-14, prompts 41-60. See the note at the top of this file. ---
      "It is 2021. Write this week's issue of my newsletter on trucking, about the driver shortage and how long trucks wait at warehouse docks.",
      "It is 2021. Write this week's issue of my newsletter on insurance, about wildfire risk and insurers pulling back from parts of California.",
      "It is 2021. Write this week's issue of my newsletter on college sports, about athletes being allowed to earn money from their own names.",
      "It is 2021. Write this week's issue of my newsletter on antitrust, about the tech bills moving through Congress and what they would actually change.",
      "It is 2021. Write this week's issue of my newsletter on China, about the crackdown on tutoring companies and what it did to foreign investors.",
      "It is 2021. Write this week's issue of my newsletter on consumer finance, about buy now, pay later and who is really doing the lending.",
      "It is 2021. Write this week's issue of my newsletter on higher education, about the enrollment drop and which colleges are feeling it first.",
      "It is 2021. Write this week's issue of my newsletter on water policy, about the first shortage declaration on the Colorado River.",
      "It is 2021. Write this week's issue of my newsletter on immigration, about visa backlogs and how long people are actually waiting.",
      "It is 2021. Write this week's issue of my newsletter on electric vehicles, about the charging network and who is expected to pay for it.",
      "It is 2021. Write this week's issue of my newsletter on mental health, about waiting lists for therapists and what is driving the demand.",
      "It is 2021. Write this week's issue of my newsletter on apparel, about cotton prices and where brands are moving their sourcing.",
      "It is 2021. Write this week's issue of my newsletter on podcasting, about exclusive deals and whether any of them earn back.",
      "It is 2021. Write this week's issue of my newsletter on state tax, about remote workers and which state gets to tax them.",
      "It is 2021. Write this week's issue of my newsletter on cruise lines, about restarting sailings and what the protocols cost per passenger.",
      "It is 2021. Write this week's issue of my newsletter on childcare, about providers closing and what it does to parents going back to work.",
      "It is 2021. Write this week's issue of my newsletter on seafood, about supply chains and what happened when restaurant demand fell away.",
      "It is 2021. Write this week's issue of my newsletter on public libraries, about what publishers charge for ebook licences.",
      "It is 2021. Write this week's issue of my newsletter on utilities, about grid spending after this year's storms.",
      "It is 2021. Write this week's issue of my newsletter on warehousing, about rents and the scramble for space close to cities.",
    ],
  },
];
