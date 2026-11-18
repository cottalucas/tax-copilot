# STYLE.md

## Purpose
How we write: product copy, docs, pull requests, commit messages. Plain, direct, no AI slop.
Load before writing any text a person will read.

## Required sections
- **Voice**: three words for the product voice.
- **Product words**: fixed terms and the words we never use for them.
- **Rules**: the list below, plus project additions.
- **Quick checks**: the pre-send checklist below.

## Rules
- Short sentences. One idea each. Active voice, a person doing something.
- Plain words. "Use", not "leverage". "Help", not "empower".
- Be specific. Name the number, the file, the screen. No vague declaratives.
- No filler openers ("Great question", "It's worth noting", "Let's dive in").
- No em dashes. No hyphen as a connector between clauses.
- No "not X, it's Y" contrasts. State Y.
- No triplets by reflex. Two items is fine.
- No hype words: seamless, robust, powerful, cutting-edge, game-changer, unlock, elevate, delve.
- No closing summaries that repeat the text. No pull-quote one-liners.
- Error messages say what happened and what to do next.
- Commit messages: imperative mood, under 72 characters, body says why.

## Quick checks
- Any adverb or hype word? Cut it.
- Any passive voice? Find the actor.
- Any em dash? Remove it.
- Three sentences the same length in a row? Break one.
- Would the reader lose anything if this sentence went? If not, delete it.

## Best known references
- Stop-Slop skill (Hardik Pandya, MIT): https://github.com/hardikpandya/stop-slop
- Wikipedia, signs of AI writing: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- Google developer documentation style guide: https://developers.google.com/style
- Microsoft Writing Style Guide: https://learn.microsoft.com/en-us/style-guide/welcome/
- US federal plain language guidelines: https://www.plainlanguage.gov/guidelines/
- Google technical writing courses: https://developers.google.com/tech-writing
- Diátaxis, four kinds of documentation: https://diataxis.fr
- Conventional Commits: https://www.conventionalcommits.org

## What worked in past projects
- ai-builder-series: stop-slop as a skill, loaded before any prose, with a 50 point score and a
  revise line at 35.
- Super Ramble: copy rules in the definition of done ("no em dashes, no hyphen as a connector")
  made style a checkable gate, not a preference.
- Super Ramble lesson: very long, hedged log entries were hard to scan. Apply the same rules
  to docs as to product copy.
