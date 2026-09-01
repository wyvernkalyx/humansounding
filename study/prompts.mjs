// The prompt sets, shared by study/generate.mjs and study/reedit.mjs.
//
// Split out of generate.mjs on 2026-09-01. The re-edit experiment seeds its
// conversations with the same prompts the corpus was built from, and it has to
// be the same list, not a copy that looks like it: a seed set that had drifted
// from the corpus set would make the two impossible to compare, and nothing
// would announce the drift.
//
// The one methodological rule these lists exist to enforce: they ask for
// writing the way a person actually asks for writing. They never say "sound
// natural", never say "sound like AI", never mention style at all. If the
// prompt shapes the prose, the study measures the prompt.

// Genres chosen to match what humansounding.com's visitors actually paste:
// workplace and marketing prose written by non-writers under time pressure.
export const GENRES = [
  {
    id: "linkedin",
    prompts: [
      "Write a LinkedIn post about why our team switched to a four-day week.",
      "Write a LinkedIn post announcing that I've been promoted to director of operations.",
      "Write a LinkedIn post about what I learned from a project that failed.",
      "Write a LinkedIn post about hiring for attitude over experience.",
      "Write a LinkedIn post about attending my first industry conference in five years.",
      "Write a LinkedIn post about why small businesses should care about cybersecurity.",
      "Write a LinkedIn post about mentoring a junior colleague.",
      "Write a LinkedIn post about leaving a job I loved.",
    ],
  },
  {
    id: "cover_letter",
    prompts: [
      "Write a cover letter for an operations manager job at a logistics company.",
      "Write a cover letter for a marketing coordinator role at a nonprofit.",
      "Write a cover letter for a junior software developer position.",
      "Write a cover letter for a school administrator job.",
      "Write a cover letter for an accounting role at a mid-sized manufacturer.",
      "Write a cover letter for a customer success manager position at a SaaS company.",
      "Write a cover letter for a nursing supervisor role at a regional hospital.",
      "Write a cover letter for a project manager role in construction.",
    ],
  },
  {
    id: "newsletter",
    prompts: [
      "Write a newsletter issue about how to build a morning routine that sticks.",
      "Write a newsletter issue about managing money in your twenties.",
      "Write a newsletter issue about why most productivity systems fail.",
      "Write a newsletter issue about dealing with burnout at work.",
      "Write a newsletter issue about the psychology of habit change.",
      "Write a newsletter issue about how to have difficult conversations.",
      "Write a newsletter issue about sleep and performance.",
      "Write a newsletter issue about what anger is actually telling you.",
    ],
  },
  {
    id: "marketing_email",
    prompts: [
      "Write a marketing email announcing a new feature in our project management app.",
      "Write a marketing email for a local gym's January membership offer.",
      "Write a marketing email inviting customers to a webinar on tax changes.",
      "Write a marketing email re-engaging customers who haven't logged in for 90 days.",
      "Write a marketing email launching a new line of running shoes.",
      "Write a marketing email for an accounting firm offering year-end planning.",
      "Write a marketing email announcing a price change to existing subscribers.",
      "Write a marketing email promoting an online course on public speaking.",
    ],
  },
  {
    id: "blog_post",
    prompts: [
      "Write a blog post about choosing a password manager.",
      "Write a blog post about remote work and company culture.",
      "Write a blog post about how to run a better meeting.",
      "Write a blog post about what to look for when buying a used car.",
      "Write a blog post about the basics of home network security.",
      "Write a blog post about switching careers in your forties.",
      "Write a blog post about why customer feedback is hard to act on.",
      "Write a blog post about starting a vegetable garden.",
    ],
  },
  {
    id: "internal_memo",
    prompts: [
      "Write a memo to staff announcing a new expense policy.",
      "Write a memo to staff about returning to the office three days a week.",
      "Write a memo announcing a reorganization of the customer service team.",
      "Write a memo to staff about a new mandatory security training.",
      "Write a memo explaining changes to the annual review process.",
      "Write a memo announcing that the company has been acquired.",
      "Write a memo to staff about reducing travel spending this quarter.",
      "Write a memo introducing a new director of engineering to the company.",
    ],
  },
  {
    id: "product_update",
    prompts: [
      "Write a product update announcing a redesigned dashboard.",
      "Write a product update explaining that we're sunsetting an old integration.",
      "Write a product update about improved mobile performance.",
      "Write a product update announcing single sign-on support.",
      "Write a product update about a new reporting feature.",
      "Write a product update apologizing for last week's outage.",
      "Write a product update announcing our new pricing tiers.",
      "Write a product update about accessibility improvements.",
    ],
  },
  {
    id: "recommendation",
    prompts: [
      "Write a letter of recommendation for a student applying to graduate school.",
      "Write a letter of recommendation for an employee applying for an internal promotion.",
      "Write a performance review for a sales rep who exceeded quota but struggled with paperwork.",
      "Write a performance review for a developer who is technically strong and hard to work with.",
      "Write a letter of recommendation for a colleague applying for a board seat.",
      "Write a performance review for a first-year employee who improved steadily.",
      "Write a letter of recommendation for a teacher applying for a principal role.",
      "Write a performance review for a manager whose team has high turnover.",
    ],
  },
];

// Conversational turns. Same rule as the document prompts and it matters more
// here: nothing mentions style, tone, structure, length or thinking out loud.
// These are ordinary requests of the kind a person types into a chat box, and
// what is being measured is what the model volunteers when nobody asked it to
// perform carefulness. Prompts that said "explain your reasoning" would plant
// the very behaviour under test.
export const CHAT_GENRES = [
  { id: "decision", prompts: [
    "Should I use Postgres or MongoDB for a booking system with about 50,000 records?",
    "We're deciding between hiring a second developer or paying for more contractors. Which way should we go?",
    "Should I take a 15% pay cut for a fully remote job?",
    "Is it worth moving our small office to a four-day week?",
    "Should we rebuild our ten-year-old internal tool or keep patching it?",
    "Do I renew a three-year software contract at a discount or go year to year?",
    "Should a two-person company bother with formal performance reviews?",
    "Is it a mistake to launch a product without a pricing page?",
  ]},
  { id: "critique_plan", prompts: [
    "Here's my plan for migrating 400 users to a new email system over one weekend. What am I missing?",
    "My plan is to run ads for six weeks, measure signups, and decide from there. Poke holes in it.",
    "I want to teach myself data analysis in three months by doing one project a week. Thoughts?",
    "We're going to fix our support backlog by hiring two temps for a month. What could go wrong?",
    "My plan for the quarter is to cut meetings by half and see what breaks. Reactions?",
    "I want to move our backups from an external drive to cloud storage and stop the drive rotation. Sound right?",
    "We plan to open a second location once the first one clears 20% margin. Is that the right trigger?",
    "I'm going to reply to every customer review personally for a year. Talk me through it.",
  ]},
  { id: "explain", prompts: [
    "Explain how DNS actually resolves a domain name.",
    "Explain what a p-value is to someone who never took statistics.",
    "Explain why software estimates are always wrong.",
    "Explain how compound interest works and why it surprises people.",
    "Explain the difference between encryption and hashing.",
    "Explain what happens to my data when a company says it was breached.",
    "Explain why airlines overbook flights.",
    "Explain how a bill becomes law in the United States.",
  ]},
  { id: "diagnose", prompts: [
    "Our website is slow every weekday at 9am and fine the rest of the day. Where do I start?",
    "Two of my team members stopped talking to each other and the work is suffering. What now?",
    "My laptop battery went from a full day to three hours in about a month. What's happening?",
    "Signups are steady but activation dropped 30% last month. How do I find the cause?",
    "Customers keep asking questions our documentation already answers. Why?",
    "Our weekly meeting always runs over and nobody remembers what was decided. Diagnose it.",
    "I keep missing deadlines even though I'm working more hours than ever. What's going on?",
    "Sales says the product is fine and support says it's broken. Who do I believe?",
  ]},
  { id: "compare", prompts: [
    "What's the difference between a VPN and a proxy, practically speaking?",
    "Compare renting and buying a home for someone who moves every four years.",
    "What's the real difference between a CFO and a controller?",
    "Compare index funds and individual stocks for a first-time investor.",
    "How do a co-op and a condo actually differ for the owner?",
    "Compare an electric car and a hybrid for someone who drives 12,000 miles a year.",
    "What's the difference between a trademark and a copyright for a small brand?",
    "Compare an in-house help desk with an outsourced one for a 60-person company.",
  ]},
  { id: "review_work", prompts: [
    "Read this and tell me if it's any good: 'Our mission is to empower businesses to unlock their full potential through innovative solutions.'",
    "Is this a good subject line? 'Quick question about your account'",
    "Here's my resume summary: 'Results-driven professional with 10+ years of experience.' Fix it or tell me why it's fine.",
    "I wrote this to a client: 'Sorry for the delay, things have been crazy here.' Should I send it?",
    "My about page opens with 'Founded in 2019, we are a team of passionate experts.' Thoughts?",
    "Is 'circle back' an acceptable thing to write in a work email?",
    "My pitch is 'Uber but for dog walking.' What's wrong with that as a description?",
    "I named my product 'Synergize.' Be straight with me.",
  ]},
  { id: "personal", prompts: [
    "I got an offer from a competitor and my current boss just asked me directly if I'm interviewing. What do I say?",
    "My friend asked me to invest in her business and I don't think it will work. How do I answer?",
    "I've been in the same job for eleven years and I can't tell if that's stability or being stuck.",
    "My neighbor's tree drops branches in my yard every storm. How do I raise it without starting a feud?",
    "I said yes to organizing the family reunion and now I regret it. What are my options?",
    "A colleague takes credit for my work in meetings. What do I actually do about it?",
    "I want to go back to school at 41 and everyone thinks it's a bad idea.",
    "My adult son wants to move back home and I'm not sure I want that.",
  ]},
  { id: "evaluate_claim", prompts: [
    "Someone told me you should never pay off a low-interest mortgage early. Is that right?",
    "My coworker says standing desks don't actually do anything. True?",
    "Is it true that you shouldn't put a hot laptop battery in the fridge?",
    "A vendor claims their tool will cut our onboarding time in half. How should I read that?",
    "I read that most startups fail because of cofounder conflict. Does that hold up?",
    "Someone said breakfast being the most important meal was invented by cereal companies. Is it?",
    "My IT guy says password rotation every 90 days is outdated advice. Is he right?",
    "A consultant told us our website needs a full rebuild, not a redesign. How do I judge that?",
  ]},
];

