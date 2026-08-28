#!/usr/bin/env python3
"""Run this AFTER dropping the Gemini hero image in as og-self-narration.png
in the repo root. It wires the image into the post as hero and og:image.
   python add-hero-image.py
Safe to run once; it refuses if the image is already wired in."""
import os, sys, re
IMG = "og-self-narration.png"
POST = "blog/ai-self-narration.html"
ALT = ("A single line of text with most of it struck through, leaving one short factual clause standing. "
       "The deleted words are the writer talking about the writing.")
CAP = "The delete test. Cut the sentence, and if no fact about the subject went with it, it was self-narration."
if not os.path.exists(IMG):
    sys.exit(f"{IMG} not found. Save the hero image to the repo root with that exact name first.")
s = open(POST, encoding="utf-8").read()
if IMG in s:
    sys.exit("Already wired in. Nothing to do.")
old = re.search(r'<meta property="og:image" content="[^"]*">', s).group(0)
s = s.replace(old, f'<meta property="og:image" content="https://humansounding.com/{IMG}">', 1)
anchor = "    <h2>The test takes a second</h2>"
assert s.count(anchor) == 1, "anchor moved; wire the figure in by hand"
fig = (f'    <figure class="chartfig">\n'
       f'      <img src="/{IMG}" alt="{ALT}">\n'
       f'      <figcaption>{CAP}</figcaption>\n'
       f'    </figure>\n\n')
s = s.replace(anchor, fig + anchor, 1)
lines = s.split("\n")
i = [n for n, l in enumerate(lines) if l.strip() == "</style>"]
assert len(i) == 1
lines[i[0]:i[0]] = [
 "  .chartfig { margin: 26px 0 30px; }",
 "  .chartfig img { width: 100%; height: auto; display: block; border: 1px solid var(--border); border-radius: 8px; }",
 "  .chartfig figcaption { font-size: 13.5px; color: var(--ink-2); margin-top: 10px; }",
]
open(POST, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print(f"Wired {IMG} in as hero and og:image. Commit {IMG}, {POST}.")
