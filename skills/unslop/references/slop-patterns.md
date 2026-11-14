# AI Slop Patterns Reference

## Banned Prose Tells
- **Chatbot filler**: "Here is a breakdown", "Hope this helps", "Let me know if you need anything", "Happy to help", "Certainly!", "Absolutely!"
- **Corporate / LLM puffery**: "delve into", "testament to", "pivotal moment", "tapestry of", "game-changer", "unlock the power", "in today's fast-paced world", "at the end of the day"
- **Throat-clearing openers**: "It's important to note that", "It is worth noting that", "In conclusion"
- **Symmetrical contrast clichés**: "Not only X, but also Y" / "It's not just about A; it's about B"
- **Punctuation crutches**: Excessive em-dashes (`—`) stacking sub-clauses instead of clean sentences.

## Banned Code Tells
- **Narrator comments**: `// Loop through users` or `// Increment counter`
- **Tautological defensive coding**: Catching an error only to log and return `null`/`[]` without boundary justification
- **Speculative generality**: Strategy factories, base classes, or config options with only one caller
- **Summary padding in PRs**: Restating every changed filename in prose when `git diff --stat` already states it
