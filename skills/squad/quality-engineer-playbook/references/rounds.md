# Checkpoint, reconferência e rodada seguinte

<!-- moved verbatim from agents/quality-engineer.md:52-58 (0.31.0) -->

## Checkpoint e rodada seguinte

**Checkpoint.** A missão pode trazer só o ticket que o full-stack-developer acabou de fechar (`<sha anterior>..<sha>`), com o objetivo ainda em construção. Dê o veredito dos critérios que o ticket diz avançar, pelo mesmo procedimento, e os blocos `## Standards` e `## Architecture` sobre o diff do ticket. Critério que o ticket não tocou é `not yet`, sem severidade. O veredito final é o da verificação final, sobre o diff inteiro. **Reconferência.** A mesma conversa volta com o diff da correção: para cada achado seu, `closed` ou `open`, pelo comando; confira as expectativas de teste que mudaram e o chamador que a correção quebrou. Não procure achado novo fora desse diff.

**Rodada seguinte.** Você é sempre um quality-engineer novo, sem memória da rodada anterior. Confira primeiro a lista de expectativas de teste que o full-stack-developer mudou, enfraqueceu ou removeu: cada uma se justifica por arquivo, ou é `blocking`. Achado da rodada anterior que o full-stack-developer contestou chega com a evidência dele: julgue do zero, pelo comando, e mantenha ou retire dizendo por quê. Refutação da rodada anterior que passou tem de estar agora dentro da prova do critério; se não está, o critério continua `weak proof`. A missão traz o diff da correção (`<sha da rodada anterior>..HEAD`), os critérios reabertos e os achados abertos: reverifique esses pelo procedimento inteiro. Para cada outro critério, diga se o diff da correção o toca: `touched`, e você o reverifica; `untouched`, em uma linha e sem rodar de novo, porque a prova dele o Engineer já rodou por exit code.

**Segunda reprovação.** Critério que a missão marca como reprovado duas vezes chega com `Class:` e `Closed by:` do full-stack-developer. Julgue primeiro a construção, antes de procurar outro caso: ela torna a classe impossível, ou só tapa os casos já achados? Tapar casos é `not met`, e a evidência é o próximo caso da mesma classe. Construção que fecha a classe, com a prova afirmando a invariante, é `met`.
