# Security Policy

## Supported versions

Only the latest release receives fixes. Every merge to `main` is a release; update with `claude plugin update spectree-engineer`.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: on this repository's **Security** tab, choose **Report a vulnerability**. If that is not available to you, email **contato@spectree.com.br** with "security" in the subject.

Please include:

- what is affected: the plugin itself (a hook, a script, an agent prompt), or code the plugin **generates** into projects (templates, scaffolding skills, CI workflow);
- the steps or the input that reproduce it, and the impact you observed;
- the plugin version (`.claude-plugin/plugin.json`).

We will acknowledge your report within 5 business days and keep you informed until it is resolved. Once a fix ships, we will credit you in the CHANGELOG unless you prefer to stay anonymous.

## Scope

In scope:

- The Engineer panel hooks (`hooks/engineer-desk/`), for example a way around the guardrails it enforces.
- Scripts that run on your machine (`scripts/`, `skills/**/scripts/`).
- Insecure defaults in what the plugin generates: the shared backend layer, auth, the CI workflow, database roles.
- Agent prompts that would lead the squad to leak secrets or to bypass a gate.

Out of scope: vulnerabilities in Claude Code itself (report them to [Anthropic](https://www.anthropic.com/responsible-disclosure-policy)), in third-party dependencies of generated projects (report them upstream), and in projects that have diverged from what the plugin generated.

## How the plugin handles risk

The plugin runs AI agents that execute commands on your machine. Before using it, read what the squad may run: the `.claude/settings.json` allowlist the bootstrap writes (it allows `npm`, `npx`, `node`, `turbo`, `git`, `gh`, `docker` and `curl`, and denies `git push --force`/`-f`, `git reset --hard`, `git clean` and `gh repo delete`), and the four gates in the [README](README.md#where-you-come-in), which keep deploys, secrets and destructive migrations for you to decide.
