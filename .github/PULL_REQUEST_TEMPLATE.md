<!-- Title in Conventional Commits: feat: …, fix: …, docs: …, chore: … -->

## What changes and why

<!-- One or two paragraphs. Link the issue: Closes #… -->

## Proof

<!-- Commands you ran and their result. Delete the lines that do not apply. -->

- [ ] `node --test tests/`
- [ ] `claude plugin validate . --strict`
- [ ] `node scripts/desk-test.mjs` (panel changes)
- [ ] `node scripts/smoke.mjs` (skills, templates or scripts)
- [ ] `node scripts/evals.mjs` (agent cards or the command; costs about US$5)

## Release

- [ ] `version` bumped in `.claude-plugin/plugin.json` (`PATCH` fix, `MINOR` any change in behaviour, `MAJOR` breaks the public API in `CONTRIBUTING.md`)
- [ ] `CHANGELOG.md` section `## [x.y.z] - <date>` written

## What was not proved

<!-- Anything you did not run or could not verify. "Nothing" is a valid answer. -->
