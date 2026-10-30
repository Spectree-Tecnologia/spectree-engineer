# spectree-engineer

Plugin Claude Code da Spectree Tecnologia: um orquestrador em pt-BR (`/engineer`) com sub-agentes especialistas, para monólitos modulares spec-driven.

- **Processo:** as skills de engenharia de [Matt Pocock](https://github.com/mattpocock/skills) — entrevista → roadmap → **design** → spec → tickets → TDD → code review → PR → **merge automático com CI verde** → próxima spec. A tela é prototipada no artefato Design antes da spec, não vista semanas depois do código. Depois da entrevista o squad anda sozinho; só sobem a você dinheiro/plataforma, mudança de escopo, impacto irreversível e o que nenhuma melhor prática decide.
- **Arquitetura:** as skills do curso *Spec-Driven Development para Monólitos Modulares* — `config-*`, `module-*`, `backend-*`, `frontend-*` — e as regras de DDD tático que elas encodam.

## Instalação

```bash
claude plugin marketplace add Spectree-Tecnologia/spectree-engineer
```

```bash
claude plugin install spectree-engineer@spectree-engineer
```

## Uso

```
/engineer                      estado do projeto, próximo passo, decisões pendentes
/engineer <o que você quer>    leva o pedido pelo fluxo
```

Na primeira vez num repositório, o Engineer roda o `setup-matt-pocock-skills` (tracker, labels, layout de domínio) antes de qualquer outra coisa.

## O squad

| Agente | Faz | Não faz |
|---|---|---|
| `engineer` (comando) | fala com você em pt-BR, grill, spec, tickets, despacha | código |
| `solutions-architect` | mapa de módulos/agregados, seams, fronteira de perguntas | escrever arquivo |
| `ui-ux-designer` | protótipo das telas no artefato Design antes da spec, design system do projeto | regra de negócio, código |
| `full-stack-developer` | um ticket, test-first, scaffold pelas skills do curso | sair do ticket |
| `quality-engineer` | review em dois eixos + fronteiras do monólito | editar |
| `platform-engineer` | bootstrap, git, worktrees, merge, Prisma, PR | código de módulo, merge na main |
| `integration-engineer` | fatos sobre sistemas externos, com fonte | afirmar de memória |

## Layout

```
commands/engineer.md       o orquestrador
agents/*.md                os seis especialistas
skills/engineering/        skills de Matt Pocock (MIT, vendorizadas — ver THIRD-PARTY-LICENSES.md)
skills/monolith/           skills do curso (Módulos 7/8)
```
