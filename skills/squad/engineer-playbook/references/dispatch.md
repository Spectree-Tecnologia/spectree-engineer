# Contrato de despacho (seção 4)

<!-- moved verbatim from commands/engineer.md:92-103 (0.31.0) -->

## 4. Contrato de despacho

Toda missão para um subagente é curta, porque o contrato e o card já carregam o contexto (passando de umas 400 palavras, repete um deles), e tem:

- **Missão:** uma frase, com o objetivo (o caminho do contrato) ou a pergunta. O que o full-stack-developer precisa saber vai para o contrato, onde o quality-engineer e o security-engineer também leem, e não para a missão.
- **Critério de saída verificável:** o comando que prova, o exit code esperado (0) e o que ele deve imprimir. Exit code decide; grep na saída não.
- **Leitura obrigatória:** `docs/architecture.md` sempre, mais 2 a 5 caminhos do projeto que já são o padrão (GLOSSARY, o contrato, `decisions.md`, um módulo equivalente). Não reescreva o conteúdo deles.
- **Guard-rails da missão:** o que está fora de escopo (para o full-stack-developer, os limites do contrato; para quem só lê, os caminhos), e sempre: "nada fica rodando — todo processo que a missão subir é parado antes do relato, PIDs listados, watcher incluído"; "scripts e logs seus ficam em `.scratch/<slug>/<papel>/`, nunca na pasta de outro agente"; "o que escreve em banco roda num banco seu (`npm run db:scratch`)".
- **Teto:** 3 tentativas da mesma abordagem pelo mesmo motivo, e o agente relata o bloqueio. Timeout, porta ocupada ou arquivo travado não contam: diagnostique e siga. Bloqueio deliberado (arquivo proibido, acesso negado, gate) se relata na hora. O full-stack-developer não tem esse teto: tem o orçamento de rodadas do contrato.
- **Modelo:** todo papel do squad roda em **Opus**: cada card declara `model: opus`, e você não passa `model` na chamada do Agent tool. A única subida é para `fable`, e só a partir da **terceira rodada de verificação** de um objetivo ou de um bug (passo 9): duas rodadas em Opus que não fecharam um critério. Nunca antes, nem por achar o objetivo difícil. **Piso: `opus`.** Nunca passe `sonnet` nem `haiku`, e não despache os agentes do harness (`web-fetch`, `Explore`, `claude-code-guide`) para o que um papel do squad faz: página externa é o **integration-engineer**, busca no projeto é você com Grep e Read. O painel sobe para `opus` qualquer despacho que cairia abaixo dele. Escreva o modelo na primeira linha da missão (`Modelo: opus — full-stack-developer do objetivo <slug>`; na subida, `Modelo: fable — rodada 3 do objetivo <slug>`), para o relato.

Sempre contexto limpo, nunca fork; a continuação (SendMessage) existe em três casos: o full-stack-developer que teve o plano aprovado e segue para o primeiro ticket, a correção do ticket por quem o construiu, e a reconferência por quem achou. O **integration-engineer** e o **solutions-architect** não gravam arquivo: o relato deles volta inline, e quem grava o que precisa ficar (`.scratch/<feature>/notes/`) é você — não peça a eles. Não repasse ao fundador a saída bruta de um subagente: traduza para o relato da seção 2.
