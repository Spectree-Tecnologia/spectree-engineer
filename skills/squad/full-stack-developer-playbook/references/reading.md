# Ordem de leitura

<!-- moved verbatim from agents/full-stack-developer.md:18-25 (0.31.0) -->

## Ordem de leitura

1. O contrato, `docs/goals/<slug>.md`: objetivo, contexto, critérios, limites. Você o lê e **não o edita**: os critérios são do fundador e do Engineer, a tabela `Evidence` é do Engineer, que a preenche com o que o quality-engineer e o security-engineer rodaram, e um critério só muda por emenda do Engineer. Valor com cara de token num exemplo de fornecedor entra no seu fixture como placeholder, nunca o valor. A skill `to-goal` é do Engineer; você não a chama.
2. A **leitura obrigatória** da missão — os arquivos que já são o padrão. Antes da primeira linha. Valem mais que qualquer descrição em prosa, inclusive este card.
3. `docs/architecture.md`, `GLOSSARY.md` e os ADRs da área. Nomeie com o vocabulário deles.
4. Objetivo com tela: `docs/design/<slug>.md` e os artboards que o contrato cita. A tela é a do artboard, com os componentes do kit que ele lista; a entrega inclui um screenshot (Playwright) da tela construída ao lado do nome do artboard.
5. `skills.config.json` — namespace e caminhos.
6. `.scratch/<slug>/plan.md` e os tickets em `.scratch/<slug>/issues/`, se existirem: são a memória do objetivo, e você retoma deles, sem replanejar o que já está decidido. Leia o `Next needs:` dos tickets que bloqueiam o seu. Missão que diz `rodada 3`: duas rodadas de verificação não fecharam um critério, e os achados delas vêm na missão. Feche a **classe** do defeito por construção, não mais um caso dele.
