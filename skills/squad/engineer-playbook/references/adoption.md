# Projeto de antes do Goal Driven (seção 3)

<!-- moved verbatim from commands/engineer.md:69-78 (0.31.0) -->

### Projeto em andamento de antes do Goal Driven (spec e tickets em `.scratch/`)

A evolução do squad não reinicia nem quebra o que estava em curso: nada se apaga, nada se refaz, e o fundador não é perguntado de novo pelo que já aprovou. Roadmap, `GLOSSARY.md`, ADRs, `docs/design/`, `decisions.md`, a branch e os commits valem como estão. `spec.md` e os tickets ficam onde estão, como histórico, e deixam de ser atualizados. O que muda é só de onde o trabalho continua. Para cada item do roadmap ainda aberto que tem `.scratch/<feature>/spec.md`, uma vez, antes de qualquer outra coisa:

1. **Inventário**, pelo **platform-engineer**: a branch de integração `<tipo>/<feature>` e o sha da ponta; os tickets, o `Status:` de cada um e quais foram mergeados nela; worktrees e branches de ticket com commits que a integração não tem (`git log <integração>..<branch>`); PR aberto. Ele não apaga, não dropa e não reseta nada. Sem git ou sem como despachar, leia o que os arquivos dizem, siga, e marque no contrato o que não pôde conferir.
2. **Contrato**, pelo `to-goal`, a partir da spec e dos tickets (a skill diz o que vai para onde), com `Adopted from .scratch/<feature>/spec.md on <data>`. O que já foi construído entra em "What exists today"; as decisões de implementação da spec e os tickets abertos entram em "Prior thinking", como sugestão ao full-stack-developer e não como ordem. `Status: approved by founder on <data da aprovação do roadmap>`: o escopo é o mesmo, então não há pergunta. Só é gate 2 se, ao escrever os critérios, aparecer regra de negócio que a spec não fechou.
3. **De onde continua**, pelo estágio em que o item estava. Protótipo esperando o fundador → passo 2, igual. Spec escrita e nada construído → passo 5. Tickets em construção → a integração vira a branch do objetivo (o nome é o mesmo); branch de ticket com trabalho verde que a integração não tem, o platform-engineer mergeia com a prova do afetado; trabalho pela metade fica na branch dele, citado no contrato para o full-stack-developer aproveitar; e segue no passo 6, com o plano do full-stack-developer partindo do que já existe. Review em curso → passo 8, com a branch como está: o pipeline julga os critérios e a correção volta ao full-stack-developer. PR aberto → termina como estava (passo 10), sem contrato.
4. Grave em `.scratch/<feature>/decisions.md` a linha `- Adopted as a goal on <data>: docs/goals/<feature>.md. Because the squad became goal driven in 0.18; spec.md and the tickets stay as history.` e relate ao fundador em uma linha por item.

Uma sessão antiga chega aqui pelas skills `to-spec` ou `implement`, que só redirecionam para esta seção: ela adota o item e continua daqui.
