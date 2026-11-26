# Contributing to spectree-engineer

Thanks for your interest. This plugin is a set of Markdown prompts (the command, agent cards and skills) plus the scripts and templates they run. A change to a prompt changes how agents behave, so changes here are held to the same standard the squad applies to the projects it builds: every change carries its proof.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** with the [bug report form](https://github.com/Spectree-Tecnologia/spectree-engineer/issues/new?template=bug_report.yml): what you asked for, what the squad did, the plugin version, and the `file:line` in the plugin if you know it.
- **Propose an improvement** with the [feature request form](https://github.com/Spectree-Tecnologia/spectree-engineer/issues/new?template=feature_request.yml). The Engineer's own retros open issues here too, labelled `enhancement` or `bug`.
- **Report a vulnerability** privately, as described in [SECURITY.md](SECURITY.md), never in a public issue.
- **Send a pull request.** For anything larger than a fix, open an issue first so we can agree on the approach.

## Development setup

You need Node.js LTS, git, and [Claude Code](https://code.claude.com). Docker is needed for the full smoke test.

```bash
git clone https://github.com/Spectree-Tecnologia/spectree-engineer.git
```

To try your local copy without installing it from the marketplace, start Claude Code with the plugin directory:

```bash
claude --plugin-dir ./spectree-engineer
```

## Tests

Run the structural guards before every pull request. They are fast and free:

```bash
node --test tests/
```

They check, among other things, that agents are named by role (`vocabulary`), that every card declares Opus (`models`), that every skill is agent-only (`skills`), the word budget of the command and the cards (`lean`), and the scripts of the generated project (`graph`, `goal-start`, `perf-base`, `dev-tooling`, `ci-moments`).

Validate the plugin manifest:

```bash
claude plugin validate . --strict
```

Test the Engineer panel. This copies the manifest, `hooks/` and `tests/` to a temporary folder and runs `claude plugin test`:

```bash
node scripts/desk-test.mjs
```

Run the bootstrap smoke test. It runs every monolith skill from this repo in a temporary project, then build and tests. With Docker it also starts Postgres and the backend and requires `401` without a token, and it exercises worktrees, perf, mutation testing, the CI scanners, `check:pr`, `goal` and `db:scratch`. It takes several minutes; set `SMOKE_KEEP=1` to keep the generated project:

```bash
node scripts/smoke.mjs
```

### Evals

`node scripts/evals.mjs` tests the agents' **judgment**, not the scaffolding. It runs [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) over `evals/`, one case per folder, each grading with checks the runner verifies (a regex, a tool that was called, a file that was created). It runs as you, on your Claude Code credentials, and costs roughly US$5 per full pass, so it is not in CI. Run it when you change an agent card or the command:

- `--case 'qe-*'` filters cases
- `--runs 3` measures variance
- `--control` proves the suite measures the card: it strips the verification procedure from the `quality-engineer` card and requires a case to **fail**

## Pull requests

- **Branch from `main`, never push to it.** One topic per branch, named `<type>/<short-slug>`.
- **Title in [Conventional Commits](https://www.conventionalcommits.org/):** `feat: …`, `fix: …`, `docs: …`, `chore: …`. Commits follow the same format.
- **Every merge is a release** (see below), so a PR that changes behaviour bumps the version and adds its CHANGELOG section.
- **Say what you did not prove.** CHANGELOG sections end with a "What was not proved" list. Write one if anything is unverified, for example evals you did not run.
- **Keep prompts lean.** `tests/lean.test.mjs` enforces a word budget on the command and the cards. New text pays for itself with text that leaves.
- Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

## Versioning and releases

The version lives in `.claude-plugin/plugin.json` and follows [SemVer](https://semver.org/). Since 1.0.0 the number is a promise about the public API below.

### Public API

What a person or a generated project depends on, and a newer version keeps working:

- **The `/engineer` command:** its name and that it takes a request in plain language.
- **The generated project's structure:** the folder layout, `skills.config.json` and `docs/architecture.md`.
- **The formats the plugin reads back:** a goal contract in `docs/goals/` and the tickets in `.scratch/<slug>/issues/`. A newer version reads what an older one wrote.
- **The scripts installed in the project:** `npm run goal`, `check:pr`, `worktree` and `db:scratch`, by name and by the arguments a project's CI or docs already call.

Everything else is internal and changes in any release: the wording of the command and the agent cards, the skills (all agent-only), which model a role runs on, and the order and number of the flow's steps and verification rounds.

### What bumps each number

- `MAJOR`: a change that breaks the public API. A project generated by the previous version stops working with the new one, or `/engineer` stops being how a person starts.
- `MINOR`: any change in behaviour that keeps existing projects working: a new agent, skill, rule or step, one that leaves, or a part of the public API marked as deprecated.
- `PATCH`: a fix that restores the behaviour already described.

**Deprecation.** A part of the public API leaves in two releases: a `MINOR` marks it deprecated in the CHANGELOG and keeps it working, and only a later `MAJOR` removes it.

No pre-release versions: the plugin has one channel, and `claude plugin update` would deliver `1.1.0-rc.1` to everyone as an ordinary update.

Every merge to `main` is a version, because `claude plugin update` compares versions, not commits. The PR bumps `version` and writes the `## [x.y.z] - <date>` section of [CHANGELOG.md](CHANGELOG.md). After the merge, a maintainer tags the merge commit `v<version>`. Before a `MINOR` that touches skills, templates or scripts, run `claude plugin validate . --strict` and `node scripts/smoke.mjs`.

## Vendored skills

`skills/engineering/` (Matt Pocock) and `skills/security/security-audit/` (Cloudflare) are vendored from other projects. Record any change to them in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md), and prefer sending general improvements upstream.

## Language

Everything in this repository is in English: docs, prompts (the command, the agent cards, the skills), code, comments, tests, evals and commit messages. The generated project is in English too, with English as the default UI locale.

The one exception is runtime behaviour, not repository content: the Engineer talks to each person in the language they chose on first contact, recorded in the project's gitignored `.engineer.local.json`. Do not write prompt text that assumes a particular conversation language.
