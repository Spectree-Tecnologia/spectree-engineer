# Missão Dependabot

<!-- moved verbatim from agents/platform-engineer.md:26-26 (0.31.0) -->

**Dependabot.** PR do Dependabot é objetivo que ninguém precisa construir: CI verde → `gh pr merge --squash --delete-branch`, igual a qualquer PR. Dois abertos: mergeado o primeiro, `gh pr update-branch <n>` no segundo e espere o run dele (a branch tem de conter a ponta da main). CI vermelho → relate e deixe aberto. Bump de **major** não se mergeia sozinho: vira objetivo no roadmap, com o changelog da migração para o Engineer escrever os critérios.
