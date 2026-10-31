# How to start with this directive

1. Create an empty folder named `chronos-cradle` and copy everything from this package into it (keep the folder structure).
2. Open a terminal in that folder, run `git init`, and commit the files.
3. Start Claude Code in that folder. It reads `CLAUDE.md` automatically.
4. First message to Claude Code:
   > Read CLAUDE.md, docs/directive/00-vision.md, docs/directive/COVERAGE.md and docs/PROGRESS.md. Skim docs/directive/SOURCE-PLAN-V2.0.md (my original full plan). Then start Part 1.1. Plan first and wait for my approval before writing files.
5. After each Part, read the report. If it looks right, reply **"Approved — continue with the next Part."** If not, say what to change.
6. Use a fresh Claude Code session every few Parts (or when the conversation gets long). `CLAUDE.md` + `PROGRESS.md` carry the context forward.

## Tips
- One Part per session step. If Claude Code proposes doing several Parts at once, say no.
- Gates (end of S01, S04, S09, S12) are where you personally review: read the docs, play the build, decide.
- If a Part turns out too big, ask Claude Code to split it (e.g. 6.3a, 6.3b) and add the pieces to PROGRESS.md.
- Keep design decisions in the docs, not in chat — chat is forgotten, docs are not.
- You can delete this file once you're set up.
