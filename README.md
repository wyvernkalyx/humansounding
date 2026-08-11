# HumanSounding

The AI Vernacular Index: a live reference for the words, phrases, and habits that mark text as model-written, with a browser-side draft checker and downloadable instruction files that steer any model away from the worst tells.

Live site: https://humansounding.com (also at https://wyvernkalyx.github.io/humansounding/)

Everything runs client-side; the draft checker never transmits your text. Analytics are aggregate-only (daily visit counts, which tells fired, referrer domains; no IPs, no cookies, no content).

## Pages

- `/` Home: the promise in one screen, routed to the Checker and Fix pages
- `/checker.html` the in-browser draft checker (12 rules + em-dash density)
- `/trends.html` the trend board, per-model accents, the numbers, and this week's edition, in tabs
- `/fix-your-ai.html` the instruction-file journey, routed by which AI you use
- `/blog.html` the weekly column ("This week in AI writing") plus the four guides
- `/about.html` honesty rules, privacy, and all 19 sources
- `/changelog.html` all weekly editions (kept URL); `/feed.xml` RSS

Shared shell lives in `assets/site.css` and `assets/site.js`. No build step; plain static HTML/CSS/JS on GitHub Pages.

## The weekly robot

`scripts/refresh.mjs` runs every Monday in GitHub Actions: it researches the last two weeks with the Claude API (web search), validates hard, updates Supabase `site_data` (trend board, weekly note, hero specimen, direction history), and regenerates the committed files: `trending.txt`, the skill's trending section, the narrative weekly column at `blog/<date>.html`, the blog index, `changelog.html`, and `feed.xml`. Every live slot on the site renders embedded fallback content if the backend is paused.

Data sources are cited on the About page. Updated weekly.
