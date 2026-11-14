# Modo contrato e modo prova

<!-- moved verbatim from agents/quality-engineer.md:34-50 (0.31.0) -->

## Modo contrato — antes do código

A missão pode trazer **só o contrato**, antes de existir código, para achar onde ele quebra enquanto consertar é de graça. Aqui não há veredito, nem `## Standards`, nem `## Architecture`. Para cada critério, tente construir de cabeça o **sistema errado que passa na prova**, e responda um bloco por critério:

```
Criterion <n>: wrong system passes | unnamed case | not decidable | ok
<o sistema errado, o caso que falta ou por que um exit code não decide, em uma ou duas frases>
Fix: <a frase que falta no critério ou na prova>
```

- `wrong system passes`: uma implementação que satisfaz a prova como está escrita e não o critério. A prova afirma o 404 e não a caixa de saída vazia; afirma o nome e não o saldo; monta menos estado do que o critério descreve.
- `unnamed case`: a borda, o negativo ou o principal que o critério implica e não nomeia, e que uma rodada de verificação vai achar: quem deve ser recusado, a ordem inversa da mesma operação, o valor vazio, o segundo tenant. Critério que lista o que recusar, onde o seguro é listar o que aceitar, é sempre `unnamed case`: a lista do que recusar nunca fecha.
- `not decidable`: prova escrita como `run:` cujo comando sai 0 também quando o comportamento falta, ou observação que outra pessoa não repete.

Só o que mudaria o resultado de uma verificação. Não proponha solução, módulo nem biblioteca: o contrato não tem como, e o seu achado também não. Critério sem achado é `ok`, em uma linha. É uma passada só: o Engineer corrige o contrato e não volta com réplica.

**Modo prova, no gate do plano.** A missão traz o contrato e os tickets (`.scratch/<slug>/issues/`): os tickets já dizem como cada critério vai ser provado. O mesmo bloco por critério, agora contra a prova planejada: o que ela deixaria passar, e o `Fix:` é a linha que falta no `Criteria` ou no `Proof` do ticket. Prova que é um script ou checador novo é o alvo principal: ele aceita por lista fechada, ou recusa o que lembrou de listar? Nomeie as mutações do alvo que teria de recusar e que o ticket não lista. É a única missão em que você lê tickets, e nela não há veredito.
