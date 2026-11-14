# O protótipo, o handoff e as rodadas

<!-- moved verbatim from agents/ui-ux-designer.md:16-42 (0.31.0) -->

**Em toda mudança com tela — o protótipo.** Chame o Artifact tool com `action: "quickstart"`, `intent: "design"`, e siga as instruções do tipo *Design*: ele é preenchido por arquivos em disco (`project/canvas.json` e um `project/<artboard>.dc.html` por artboard) publicados com `root`/`files`. Escreva esses arquivos em `docs/design/<feature-slug>/project/` do projeto — o protótipo fica versionado ao lado do código — e publique a partir daí, em três passos: criar com `type_url` + `title` + `auto_open: "after_first_write"` (sem arquivos); publicar `canvas.json` + `Main.dc.html` com `url`/`root`/`files`; depois um artboard por chamada. Um artefato por mudança, com um artboard por **tela × estado que se aplica** (vazio, carregando, preenchido, erro de validação, sucesso, sem permissão — só os que a tela tem). Fluxo entre artboards na ordem em que o usuário percorre. O nome `<módulo>/<tela>/<estado>` vai no `title` do board em `canvas.json`; o arquivo é plano e sem espaço (`account-list-empty.dc.html`), e `Main.dc.html` é a primeira tela do fluxo no estado preenchido. Artboard de página leva `"expand": "fill"`.

Grave o handoff em `docs/design/<feature-slug>.md`:

```
# <Feature> — design

Prototype: <URL do artefato>
Design system: <URL>

| Artboard | Route | Module | Components from the kit | New components |
|---|---|---|---|---|

## Wireframes
- <tela> — docs/design/<feature-slug>/wireframes/<tela>.txt, from <a referência do fundador>

## Decisions
- <uma linha por decisão de UX, com o porquê>

## Open questions
- <o que você não decide, com a sua recomendação; o Engineer leva ao fundador junto com a URL, e a resposta dele volta como rodada>

## Rounds
- <data> — <o que o fundador pediu> → <o que mudou, quais artboards>
```

**Em cada rodada seguinte** a missão traz o texto do fundador (resposta, comentário no artboard, pedido). Altere só os artboards que ele tocou, republique no **mesmo** artefato (`url`), acrescente a linha em "Rounds" e, se uma resposta fechou uma open question, mova-a para "Decisions". Quando a missão disser que ele aprovou, grave `Approved by founder on <data>` logo abaixo de `Prototype:` e não toque mais nos artboards: o contrato do objetivo vai citá-los como critério de sucesso.
