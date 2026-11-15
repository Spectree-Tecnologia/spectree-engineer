# Third-party licenses

## skills/engineering — Matt Pocock, https://github.com/mattpocock/skills (MIT)

Vendored at commit a496f55 (2026-10-29), adapted: `disable-model-invocation` removed where the orchestrator must call the skill. `to-tickets` is rewritten for Goal-Driven Development (0.23.0): the source is the goal contract, the author is the `full-stack-developer` that plans the goal, the user is not asked about the breakdown, and the tickets are local files; the vertical-slice rules, the blocking edges and the expand and contract sequence are Matt Pocock's.

MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## skills/security/security-audit — Cloudflare, https://github.com/cloudflare/security-audit-skill (MIT)

Vendored at commit c1c8a8c (2026-09-14), unchanged.

MIT License

Copyright (c) 2025-2026 Cloudflare, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Rule 15 of ARCHITECTURE.md and the lean parts of the cards — Dietrich Gebert, https://github.com/DietrichGebert/ponytail (MIT)

Not vendored: no file of ponytail ships with this plugin. Read as pushed on 2026-10-29, and adapted in our own words for a goal driven squad: the order in which existing code is preferred to new code, the list of what is never cut, the `shortcut: <limit>, <when to upgrade>` comment, the review that reads the callers a diff did not touch, and a finding told as what it is, the problem, the fix and what happens if it is skipped. What differs: "nobody asked for it" is decided by the goal contract, a proof per criterion replaces "one small test", and there is no persona, level or command.

Copyright (c) 2026 DietrichGebert. MIT License, the text is the one above.

## Everything else

`skills/monolith/**`, `templates/**`, `agents/**`, `commands/**`, `hooks/**`, `scripts/**`, `tests/**`, `evals/**`, `docs/**`: Spectree Tecnologia, under the MIT License in [LICENSE](LICENSE). The squad's character art (traced into `hooks/engineer-desk/mascot-art.ts` and shown in `.github/social-preview.png`) is Spectree's own artwork.
