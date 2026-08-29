# Two other people wrote my rules without me, and got my answers

Somebody pointed me at a GitHub repository this week called prose-humanizer, by
Aman Maqsood. It is an agent skill and a small command-line linter that looks for the
same kind of writing tells this site catalogs, built by somebody I have never
spoken to, from sources I have never read. Twenty-two patterns in a JSON file.

I have 456 documents sitting on a disk here from four models plus a human
baseline, so I ran his linter over all of them. Then I found a second project
doing the same thing, called soundshuman, and ran that one too. Three rule sets
now, written by three people working separately, pointed at one pile of text.

They agree with me on three things. They also both contain the same measurement
mistake, which is the more useful half of this.

## Where they agree

### Em dashes are a Claude habit

My own measurement puts Claude Opus 5 at 11.05
per thousand words against 3.83 in pre-ChatGPT Medium articles. The
prose-humanizer rule is not a density rule at all; it looks for two dashes
inside one line, and it gives Claude 1.69 against 0.51 for the same human set.
The soundshuman rule counts em dashes, en dashes, and spaced double hyphens
together, and it gives Claude 12.20 against 4.17. Three definitions, three
authors, and Claude lands about three times the human rate in all of them. The
other three models sit at or below the humans in all of them too.

### The 2023 vocabulary is a Gemini habit

I built my word list
from published frequency research. His list has 54 words and came from somewhere
else. Mine gives Gemini 1.01 per thousand words. His gives Gemini 1.03, against
0.19 for Claude, 0.18 for the OpenAI chat model, and 0.23 for GPT-5.5. Two lists
chosen by two people who did not compare notes, landing four decimal places
apart on the same model.

### Negative parallelism is a bad tell

This is the "it's not just X, it's Y"
construction that every listicle names first. Under the prose-humanizer rule the human set runs 0.18 per thousand words and every model runs at or below that. Under
soundshuman's the humans run 0.30 and every model runs below. Under mine, humans
sit above two of the four models. Nobody's implementation makes it work, and I
have now watched it fail three times.

## Where they are wrong in the same way

The single biggest number in the prose-humanizer run is a rule called
decorative-formatting, which produced 750 of 1,016 total findings across all 456
documents. It matches a markdown bullet carrying a bolded label. Gemini fires it
at 9.83 per thousand words. My humans fire it at zero.

That gap has nothing to do with writing. My human baseline is Medium articles
scraped to plain text. Exactly one of the forty contains a `**`, and none
contains a markdown heading. My AI documents were written to files by an API, so
they arrive as markdown, and 40 of 40 Gemini documents contain bold. The rule
cannot fire on one side of the comparison for reasons that have nothing to do
with the sentences. Take it out and every model lands at or below the human
rate.

soundshuman makes the same mistake with a different pattern. It counts curly
quotation marks, and humans run 11.24 per thousand words against Claude at zero.
Scraped web pages preserve curly quotes because a CMS put them there. Text
written to a file by an API arrives with straight ones. That rule runs backward,
and its own note calls it a weak signal, which is generous.

I filed the first one as an issue. I am not in a position to be smug about
either, because the same trap ate a finding of mine three weeks ago: GPT-5.5
showed contrastive negation at twelve times the human rate until I checked it by
genre and found every hit was in the two long formats, which were the only
formats my human set covered.

## The rule I nearly kept

One rule in the three sets separates all four models from the humans in the same
direction. It is the rule of three, "X, Y, and Z", and soundshuman counts it at
0.79 for humans against 4.35 and 4.46 for the two OpenAI models.

Two things are tangled in it. The regular expression only matches the version
with the serial comma, and humans use the serial comma about 60 percent of the
time while the models use it 95 to 100 percent of the time. So the rule is partly
counting a punctuation preference. Counting both spellings closes about a third
of the gap.

The rest is genre. GPT-5.5 writes 10.91 three-item lists per thousand words in
recommendation letters and 1.81 in newsletters. Short documents are full of
them. My human set is all long-form. Restricting every model to blog posts and
newsletters, humans run 1.30, Claude runs 1.10, Gemini 1.67, ChatGPT 2.39, and
GPT-5.5 2.27. A three-times effect becomes a not-quite-two-times effect, and
Claude drops below the people.

It goes in my notebook. It stays out of the checker.

## The part that surprised me

I cloned all five open projects in this space, including the four that
prose-humanizer credits. Here is every one of them by total size, documentation
and code included: 8,074 words, 9,239, 13,381, 1,987, and 4,722.

None of them contains a corpus. There are no documents in any of them, and no
rate tables. What the repositories call tests are hand-written one-line strings
designed to trip specific regular expressions, which is a reasonable way to test a regular
expression and no way at all to find out whether a rule describes anybody's
writing.

I did not expect that. I assumed I was the amateur here and that somewhere in
this field there was a real dataset I had failed to find. I have not found one
yet. Five projects, all of them shipping a rule list, and zero measured
documents between them.

## What changes here

The three agreements make me more confident in the model-specific finding than I
was on Monday, and less confident than I would be if the three of us had used
different corpora instead of different rules. Same text, three instruments, is a
weaker design than three texts and one instrument. It rules out my regular
expressions being wrong. It does not rule out my forty Medium articles being
unrepresentative, and I have since measured a second human set that runs at a
quarter of their em dash rate, so that concern is live.

The formatting confound is now a standing check rather than a lesson. Any rule
that keys on markup gets stripped or excluded before it goes near a comparison,
because my human corpus is plain text and my machine corpus is not, and that
difference will manufacture a result every single time.

The rules from all three projects are readable and machine-readable, which is
how I was able to do any of this in an afternoon. Mine are parsed out of the
checker page at runtime, which keeps the study honest but makes them awkward for
anybody else to cite. That is the next thing I fix.
