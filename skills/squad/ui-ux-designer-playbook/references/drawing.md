# Como desenhar

<!-- moved verbatim from agents/ui-ux-designer.md:44-55 (0.31.0) -->

## Como desenhar

- **Referência vira wireframe antes de artboard.** Sempre que a missão traz uma referência do fundador (screenshot, imagem, print de outro app, link, descrição de tela), chame o Skill tool com `to-wireframe` antes de desenhar: `format=ascii image=<caminho>` para imagem, `format=ascii brief="<a descrição>"` para texto, com `output=docs/design/<feature-slug>/wireframes/<tela>.txt`. O wireframe tipado é a planta: cada região (`nav`, `card`, `form`…) vira um componente do kit, cada tag (`[h1:]`, `[btn:]`, `[in:]`…) um elemento, e o artboard nasce dele, não da imagem. Liste os wireframes no handoff (seção "Wireframes", um por linha com a referência de origem). Referência que contradiz o design system: o design system vence, e a diferença vai para "Decisions". Uma referência que o fundador manda para "ficar parecido com isto" sem wireframe no meio vira cópia visual sem estrutura, e é isso que a regra evita.
- **Leia antes:** `GLOSSARY.md` (os nomes das coisas na tela são os do glossário), a conversa/notas do grill que a missão aponta, a tela existente mais parecida em `apps/frontend/src/modules/*/pages/`. Tela nova que ignora a tela vizinha é a inconsistência que ninguém pede e todo mundo nota.
- **Componentes do kit primeiro.** Componente novo só quando nenhum do kit serve; ele entra na coluna "New components" e vira critério de sucesso do contrato.
- **Formulário é o schema.** Campos, obrigatoriedade e mensagens de validação vêm dos VOs do módulo (o front usa `v.defineObject` sobre eles). Não invente regra na tela: pergunte ao Engineer, que pergunta ao solutions-architect.
- **Lo-fi antes de hi-fi quando a dúvida é de fluxo.** Wireframe em cinza resolve "qual a ordem das telas"; só depois de o fundador aprovar o fluxo, acabamento. Duas rodadas curtas valem mais que uma longa.
- **Renderize antes de publicar.** Todo artboard que você alterou abre num browser headless a partir do disco (por isso cada `*.dc.html` linka `tokens.css` e `bundle.css` por caminho relativo, nunca por URL do artefato), e o screenshot vai no relato ao Engineer. Artefato publicado sem screenshot é artefato que o fundador abre quebrado.
- **CSS nunca por regex.** Concatene arquivos inteiros ou edite com substituição exata (Edit tool). Um `replace` que apaga três seletores deixa declarações órfãs e ninguém vê até o fundador abrir.
- **Comentário numa tela é regra do produto.** Propague para todo artboard onde a mesma coisa aparece, registre em "Decisions", e nunca sobrescreva o que o fundador editou no canvas.
- **Acessibilidade não é opcional:** contraste, foco visível, rótulo em todo campo, erro ligado ao campo.
- **Mobile é um estado**, não um artboard a mais quando sobrar tempo: cada tela principal tem o seu artboard de 375px.
