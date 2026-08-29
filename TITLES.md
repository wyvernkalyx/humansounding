# Title and slug standard for humansounding.com

Adopted 2026-08-29. Applies to every new article. The reason for writing it down
is that the site already does this well on one half of its pages and badly on
the other, and the difference is measurable in search.

## What the site already gets right

The static pages are named the way people type:

- `why-does-ai-use-em-dashes.html` — "Why Does AI Use So Many Em Dashes? The Data"
- `words-ai-overuses.html` — "Words AI Overuses: The Measured List (Updated Weekly)"
- `how-to-tell-if-ai-wrote-it.html` — "How to Tell If Something Was Written by AI (2026 Guide)"
- `make-chatgpt-not-sound-like-ai.html` — "How to Make ChatGPT Not Sound Like AI"

These are queries with a page attached. The em-dash one reached position 8 in
nineteen days.

## What it gets wrong

The blog posts are named for readers who already arrived:

- "Every tell I tested turned out to belong to one model" — nobody searches
  "tell." The page is about which AI model overuses which construction, and the
  title contains none of those words.
- "Delete every sentence that's about the writing" — good instruction, zero
  search surface.
- "I had an AI build a website that catches AI writing" — this one works, because
  "AI writing" is in it.

A blog post that only makes sense once you are on the site is a post that only
gets read by people already on the site.

## The rule

**A title has to survive alone in a search result.** Assume the reader has never
heard of this site, sees one line of text among nine others, and is deciding in
under a second. It must say what the article is about with no help from the page
around it.

Four requirements:

1. **Contain the words a person would type.** "AI checker", "AI detector", "AI
   writing", "ChatGPT", "Claude", "em dash", "AI humanizer". Never internal
   vocabulary: "tell", "rule set", "corpus", "arm", "self-narration". Those are
   ours, not theirs.
2. **Fit in about 55 characters.** The template appends " | HumanSounding",
   which is 17 more, and Google truncates near 60. A title that clips loses its
   ending, so put the load-bearing words first.
3. **Say the finding or the question, not the vibe.** "Do AI-writing checkers
   agree with each other? I tested three" describes the article. "Three rule
   sets, three authors, one answer" describes a mood.
4. **Do not compete with our own pages.** Before choosing, check what
   humansounding.com already ranks for. Two pages aimed at one query split the
   traffic and neither wins. Pick the angle nothing here covers yet.

Question titles are worth reaching for. People type questions, and the questions
this site can answer with numbers have almost no good results behind them
because nobody else in the space measures anything.

## The slug

The filename is a ranking surface and it is visible in every shared link. Match
it to the title, lowercase, hyphenated, no stop words that carry nothing.

- Title: "Do AI-writing checkers agree with each other? I tested three"
- Slug: `do-ai-writing-checkers-agree.html`

Do not use dates as slugs for anything other than the weekly refresh posts.
`2026-08-24.html` cannot rank for anything and cannot be recognized in a link.

Slugs are permanent once published. Changing one costs the accumulated links, so
get it right before the first commit. Fixing it the same afternoon is free;
fixing it a month later is not.

## Checklist before publishing

- [ ] Would this make sense to somebody who has never seen the site?
- [ ] Does it contain at least one phrase a stranger would actually type?
- [ ] Under 55 characters, load-bearing words first?
- [ ] Does it state the finding or ask the question, rather than gesture at one?
- [ ] Does any existing page here already target the same query?
- [ ] Does the slug match the title?
- [ ] Are the title, `og:title`, the schema `headline`, the `<h1>`, the blog card
      and the sitemap entry all the same string?

That last one is not pedantry. Six places carry the title, and the drafts on this
site have gone out with three of them disagreeing.

## Applies to the hero image too

The image title is read by people scrolling a feed, and it is the alt text a
screen reader gets. Same standard: say the finding. It is also subject to the
voice profile, and the first version of the most recent one opened with a rule of
three, which that profile bans outright.
