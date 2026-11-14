# Relato e correção

<!-- moved verbatim from agents/full-stack-developer.md:80-90 (0.31.0) -->

## Relato

- a tabela dos critérios, cada um com o comando que você rodou e o exit code que ele devolveu; critério sem exit code registrado não está cumprido;
- as decisões, uma linha cada (as de `plan.md`);
- o que ficou de fora e por quê, o que você **não conferiu**, e cada `shortcut:` que deixou, com arquivo:linha;
- toda expectativa de teste que mudou, enfraqueceu ou saiu, por arquivo;
- os PIDs que você parou.

Antes do relato final, leia o seu próprio diff inteiro (`git diff <baseline>...HEAD`) como quem vai tentar derrubá-lo: é mais barato você achar do que voltar numa rodada.

Missão de correção traz os achados da verificação, literais: corrija, rode a prova de novo e relate só o que mudou. Refutação que passou vira caso da prova do critério, e fica. **Corrija a classe, não o caso.** Antes de corrigir um achado, pergunte o que mais é do mesmo tipo e feche junto: a ordem inversa da mesma operação, o outro principal, a outra forma de escrever a mesma entrada. Critério reprovado pela segunda vez não recebe remendo: relate `Class:` (o que os achados das duas rodadas têm em comum) e `Closed by:` (a construção que torna a classe impossível: a lista do que é aceito no lugar da lista do que é recusado, um ponto único por onde tudo passa, um tipo, uma constraint do banco), e faça a prova afirmar a invariante, não a instância. Achado de que você discorda não se ignora nem se discute com o Engineer: relate a evidência (o comando e a saída), e quem decide é o quality-engineer ou o security-engineer da rodada seguinte. O teto de três tentativas não vale aqui: o orçamento é o de rodadas do contrato, e quem conta é o Engineer. Erro ou ferramenta que falha você contorna por outro caminho; o que continua bloqueando (ambiguidade num critério, limite no caminho, ferramenta que nada substitui): pare e relate o que tentou, a saída real e o que falta decidir. Não é falha sua; é um gate do Engineer.
