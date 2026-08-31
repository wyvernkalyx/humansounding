# Stop Teaching Staff to Spot Phishing by Its Writing

**What fifteen awareness sources actually tell people to look for, and what happens when you measure it.**

Gregg Westgate
Draft v3, 31 August 2026

---

## Summary

Six of the fifteen security-awareness sources I surveyed still tell staff to spot phishing by its spelling and grammar. Four now warn against doing that. CISA and Microsoft published opposite guidance on it in the same year, and both pages are current as I write.

So I measured it. Across 110,305 words of machine and human writing, fourteen of the fifteen writing-style rules I tested failed to separate the two. One rule did separate, and it turned out to identify a single vendor's model rather than machine writing in general. It is already decaying.

That is the accuracy problem. There is a worse one underneath it, which is that an attacker decides how well written the message is. It is a setting they choose, and a defense built on prose quality is defeated by anyone who bothers to change it.

None of the standards ever asked for the grammar advice. It filled a gap they left open. The last section of this paper is about what belongs in that gap instead.

---

## How I got here

I run a website that tracks the tells of AI writing.

The thing that keeps coming up in forums where people discuss this is why models reach for the same handful of habits, over and over, across vendors. It has produced two industries facing each other. Dozens of sites sell tools that strip the tells out so your text passes an AI checker. Dozens more sell tools that catch them. Neither side publishes much evidence.

So my site measures. Every tell somebody proposes gets tested against a corpus, tracked over time as the models change, and reported with the number attached.

Doing that to my own rules was unpleasant. Most of them did not survive it.

Then I went looking for who else was making claims of this shape, and found them somewhere I did not expect. Microsoft's phishing guidance, updated on 15 May 2026, tells people: "If an email message has obvious spelling or grammatical errors, it might be a scam." That advice appears in corporate security training, where it reaches the people whose job includes stopping a wire transfer.

Which raised the question this paper is about: what has AI writing done to security awareness training, and does the advice in that training still hold?

## The standards never asked for this

I assumed some framework had prescribed the grammar advice, and that everything downstream was inheriting it. So I went and read them.

**NIST SP 800-50r1**, "Building a Cybersecurity and Privacy Learning Program", published 12 September 2024, supersedes both SP 800-16 from 1998 and the original SP 800-50 from 2003. I read it looking specifically for prescribed phishing indicators. There are none. It covers program lifecycle, roles, audience segmentation and metrics, and it insists that phishing simulations be non-punitive learning rather than discipline. On content it says things like "following the rules established to avoid social engineering attacks", which hands the rules back to you.

**CIS Control 14**, in version 8.1, has nine safeguards. Number 14.2 reads in full: "Train workforce members to recognize social engineering attacks, such as phishing, business email compromise (BEC), pretexting, and tailgating." None of the nine mentions writing quality.

**ISO 27002 control 6.3** and **PCI DSS requirement 12.6** both require that awareness training happen and that it cover social engineering. Neither specifies what to teach.

**ISC2** publishes the CBK, which is exam scope, and the CPE handbook, which is credit rules. It publishes no curriculum guidance for corporate awareness programs.

Every one of them specifies the outcome and delegates the content. That is a reasonable way to write a standard, because the threat moves faster than the standard can. It also means nobody owns the question of whether the content is any good, and whatever filled the gap did so without review.

## What filled the gap

Sixteen public pages across fifteen organizations. Verbatim quotes, and the date each page shows.

**Still teaching it:**

| Source | What it says | Date |
|---|---|---|
| KnowBe4, Social Engineering Indicators guide | "Are there obvious spelling and grammar errors in the email?" | 19 May 2026 |
| Microsoft, phishing guidance | "If an email message has obvious spelling or grammatical errors, it might be a scam." | 15 May 2026 |
| Hoxhunt, phishing red flags | "Poor grammar, generic greetings, awkward tone" | updated 5 Jan 2026 |
| Cofense, ten most common signs | "One of the more common signs of a phishing email is bad spelling and the incorrect use of grammar." | 21 Sep 2023 |
| Mimecast, how to spot phishing | "Poor spelling and grammar. Many phishing emails include misspelled words, unusual language and poor grammar" | undated |
| Infosec Institute, ten tips | "Emails from legitimate companies do not usually have spelling or grammar mistakes." | 1 Jun 2018 |

**Warning against it:**

| Source | What it says | Date |
|---|---|---|
| SANS Security Awareness | "Avoid using misspellings or poor grammar as an indicator." | 20 Feb 2024 |
| CISA | "A common sign used to be poor grammar or misspellings although in the era of artificial intelligence (AI)..." | undated |
| UK NCSC, consumer guidance | "It used to be easier to spot scams. They might contain bad spelling or grammar" | reviewed 5 Sep 2022 |
| Huntress | "attackers increasingly use AI to generate clean, on-brand messages that look like real corporate email" | 26 Jun 2026 |

Proofpoint sits between the two groups. Its guide to spotting phishing lists no grammar item among its named indicators, and its threat reference notes attackers using AI to "mimic a colleague's writing style". That same threat reference annotates a sample email as containing "typos and poor grammar". A vendor can be halfway through changing its mind, and the old material outlives the new position. CybSafe comes at it from a third direction, arguing that badly written phishing works anyway.

Three details in those tables carry more weight than the six-to-four split.

**The KnowBe4 entry is live product behavior.** It comes from the guide describing the Social Engineering Indicators used in its phishing templates, which is the document a customer reads when configuring what their own staff will be tested on. It was last updated in May of this year.

**Microsoft and CISA are telling the same person opposite things.** CISA's page names artificial intelligence as the reason the old advice expired. Microsoft's, updated four months later, still gives the old advice. A US company following federal guidance and running Microsoft's own security stack is receiving both, has no way to know they conflict, and no reason to suspect it.

**The dates run the wrong way.** If this were simply old content nobody had revisited, the pages teaching the grammar item would be the stale ones. They are not. Two of the six were updated in 2026, one in January and one in May. The advice is being actively maintained.

## Do these tells work at all?

Before the numbers, what this measurement is and what it is not, because it is easy to expect the wrong thing from it.

I do not have a corpus of phishing emails. Nobody publishes one with reliable authorship labels, and I could not release one if I built it. So this measures something adjacent: whether these writing tells can distinguish machine text from human text **under the friendliest possible conditions**. Ordinary prose. Nobody trying to hide. Authorship known with certainty on either side. No adversary at all.

That makes it a ceiling. Whatever these tells achieve here is the most they will ever achieve, because a phishing email is the same problem with someone actively working against you. A rule that cannot pass the easy version does not get to be trusted on the hard one.

Here is the easy version.

I built six corpora: four sets of machine writing generated through vendor APIs against a recorded prompt list, and two sets of human writing published before ChatGPT existed. 110,305 words. Rates are per 1,000 words with 95% bootstrap confidence intervals that resample whole documents, so one long strange article cannot manufacture a tight result. A separation verdict is reported only where two intervals sit clear of each other. No accuracy scores and no classifier, because the design does not support them.

Fourteen of the fifteen rules failed to separate machine writing from human writing. Four never fired at all. Six fired fewer than seven times across the entire corpus. Three fired often enough to compare, and their intervals overlapped human writing. One was elevated in two of the four models, which makes it a family habit rather than a fingerprint.

One rule did separate.

| Set | Em dashes per 1,000 words | 95% CI |
|---|---|---|
| Claude Opus 5 | 11.05 | [9.66, 12.53] |
| Human, Medium articles | 3.83 | [2.65, 5.08] |
| ChatGPT | 3.30 | [1.89, 4.88] |
| Gemini 3.7 Flash | 2.70 | [1.99, 3.45] |
| GPT-5.5 | 1.63 | [0.80, 2.81] |
| Human, newsletters | 1.05 | [0.20, 2.29] |

Read the top row on its own and "em dashes mean AI" looks proven. Read the whole column and three of the four models sit at or below the rate of the human articles. Anyone applying that rule today is running a Claude detector, and getting the other three vendors backwards.

It is also perishable. Published figures put GPT-4.1 at 10.62 em dashes per thousand words and GPT-5.4 at 1.43. One vendor tuned the habit out of its models inside a year. A tell with that half-life cannot survive an annual training refresh, and nothing announces its expiry. The training keeps teaching it, the staff keep applying it, and the number quietly stopped being true some time last spring.

The rules, the rates and the intervals are published as JSON at humansounding.com/rules.json. The corpus generator and the measurement scripts are in the repository at github.com/wyvernkalyx/humansounding under `study/`, with the 416 machine-written documents. If a rule is wrong, the numbers are there to argue with.

## Why it cannot work, rather than merely does not

The measurement says these tells fail. It does not say why, and the why turns out to have been published in 2012.

Cormac Herley, then at Microsoft Research, asked why advance-fee scammers still claimed to be Nigerian princes long after the joke had gone stale. His answer was that the implausibility is the product. "By sending an email that repels all but the most gullible the scammer gets the most promising marks to self-select, and tilts the true to false positive ratio in his favor." The expensive part of that scam is the weeks of human conversation after somebody replies. Filtering hard at the first message protects that budget by discarding anyone who would waste it.

Herley is careful about scope and the popular version of his argument usually is not. He limits it to attacks where each target costs the attacker something, and states explicitly that spam, with a per-target cost near zero, works differently. So the deliberate-error story fits advance-fee fraud, romance scams and the long conversational stages of business email compromise. It probably does not explain bulk credential harvesting, where the landing page is automated and there is no reason to discard anyone. The errors there are more likely just cheap writing by people paid very little.

The part that survives the qualifier governs everything downstream. **How well written the message is, is a setting the attacker chooses.** It falls out of their cost model, and they tune it up or down to suit the attack. Nothing about it leaks past them on its way to you.

Which means style-based detection is worse off than merely inaccurate. It is defeated by construction. The attacker is already deciding how detectable to be, before your training ever reaches your staff, and the tools for making that decision are free and take one paste.

## And it inverts where the money is

Bulk phishing is built to be obvious. That is precisely the population the grammar advice ever caught, and it is the population your mail gateway was already filtering on sender reputation, authentication failures and known-bad infrastructure, none of which involve a human reading anything.

Now the other end.

Your accounts payable clerk receives an email inside a thread she has been part of for three weeks, about an invoice she recognizes, from a supplier contact she has emailed twice this month. The sending address is correct, because the supplier's mailbox is genuinely compromised and the message really did come from it. The signature block is the real one. The tone matches the last eleven messages in the thread, because the attacker read them. The only new thing is a line saying their bank has changed and here are the updated details.

There is no spelling error to find. There was never going to be one. At this end of the market the attacker's incentive runs hard toward prose indistinguishable from the house style, because the target pool is one person and a message that reads wrong ends the campaign rather than costing one send out of a million.

The FBI's Internet Crime Complaint Center puts exposed losses from business email compromise at $55,499,915,582 across 305,033 incidents between October 2013 and December 2023.

So the advice is aimed at the attacks that were already being stopped, and absent from the ones taking the money. Worse, it teaches the opposite of what the clerk needs. Tell someone that machine-written mail contains spelling errors and you have also taught them that clean mail was written by a person. That second inference is false, it is the one they will actually use, and it points them at trust in the exact moment they should hesitate.

Before 2022 that inference was defensible, because good writing cost effort and effort implied investment. Effort is now free. Any program still treating prose quality as a proxy for legitimacy is running on an assumption that expired with the technology.

The channel is moving as well. CNN reported in May 2024, citing a statement from the engineering firm Arup, that an employee joined a video call with several colleagues, approved transfers worth about $25 million, and later learned every other participant was a deepfake. Arup's own published material does not describe the incident, so that account rests on the company's statement to the press rather than a filing. Training that treats a familiar voice or face as proof of identity is already behind.

## The advice has a second cost

KnowBe4's red-flags material describes "grammar issues indicating the sender is not a native language speaker". Hoxhunt's January 2026 page carries the same idea.

Read that as an instruction and see where it lands. You are telling staff that imperfect English is a fraud signal. In any company with offshore engineering, an outsourced finance function, or suppliers outside the English-speaking world, the people that instruction actually flags are colleagues and partners, every day, at volume.

The measurement says it catches no attackers to compensate. Put this one in front of an executive before any of the numbers, because it is a cost the organization is paying now and can stop paying this week.

## What to keep, retire and add

### Keep

**Out-of-band verification.** Any request that moves money or credentials gets confirmed on a channel the sender did not choose. This is the single control that survives everything in this paper, because it never requires anyone to judge the message. It works whoever wrote it, however well, in whatever medium.

**The shape of the request.** Urgency combined with secrecy combined with a change to payment details has been the pattern for over a decade. It survives fluent attackers completely intact, because it describes what the attacker must obtain, whatever words they use to ask.

**Non-punitive reporting.** NIST asks for this directly, and it matters more as the taught heuristics stop working. A person who is unsure and unafraid to say so is worth more than a person confident in a retired heuristic.

### Retire, out loud

**The spelling and grammar advice.** Also "awkward phrasing", "unusual tone", and "sounds robotic".

Deleting the slide is not enough. Your staff were taught this years ago and nobody has ever told them to stop, so they are still running it, and silence reads as continued endorsement. Name the retired advice in the training, say plainly that it stopped working and roughly when, and say why. Unlearning has to be taught as deliberately as learning was.

**"External means suspicious" as the organizing axis.** Compromised internal accounts and compromised supplier accounts both sit on the trusted side of that line, and those are the expensive ones. Sort by what is being asked for. Where it came from settles nothing.

### Add

**Controls that never involve the reader.** Dual authorization on payment changes. A mandatory hold on new bank details. Vendor bank-change verification written down as a procedure, with the callback going to a number from your own records and never a number supplied in the email. The clerk in the scenario above cannot win by reading more carefully. She can win if the process makes the change impossible to complete alone.

**Explicit permission to challenge authority.** Whaling runs on hierarchy, and the failure mode is a junior person who suspects something and does not want to look foolish questioning the CFO. Make it policy that any payment request may be verified, that nobody is ever penalized for verifying one, and that executives expect the call. This costs nothing and it is the control most often missing.

**Technical controls that reduce what reaches a person at all.** DMARC at enforcement, external-sender banners, impersonation protection on executive display names. Awareness belongs at the end of that chain. Any program treating the human as the primary filter has already accepted the loss.

**Permission to use AI at work.** Say plainly that AI-assisted mail from real colleagues is normal now. Staff who believe machine-written text is inherently suspicious will report each other, and that volume will bury the reports you need.

### Measure it on outcomes

Payments stopped. Genuine attempts reported. Time from receipt to report. Click rates measure whether people can spot the phish, which is the skill that expired. A program optimizing for click rate is optimizing for the wrong thing, and it will look healthy the whole time it does so.

## Limits

My corpora are blog posts, Medium articles and email newsletters. **None of them are phishing emails and none are business correspondence.** The ceiling argument above is what carries the inference from one to the other, and that is reasoning, with no measurement behind it. That seam is where someone should push back first.

Author identities in the human Medium set were not recorded, and I found a defect in my own collection script that let a single source file contribute more documents than intended. Four models is a small slice of what exists, and all four were sampled inside one week.

I read only public vendor pages. Proofpoint's courseware sits behind a customer login and I could not see it, and that limitation applies to every vendor named here. A vendor whose public page teaches the grammar item may teach something better inside the product, and a vendor whose public page is silent may teach it anyway. What the tables show is what a customer or a curious buyer can read today.

What would change my mind: a writing-style rule that separates machine from human text across at least three vendors, holds on a human corpus in the same genre as the machine one, and survives having markup stripped from the machine and human sets alike. I have not found one, and I have now tested my own fifteen and two other people's rule sets.

## One thing to do

Open your own awareness program's material and search it for the word "grammar."

Whatever comes back is the part of your training that stopped working. Until somebody tells your staff it stopped working, they are still using it.
