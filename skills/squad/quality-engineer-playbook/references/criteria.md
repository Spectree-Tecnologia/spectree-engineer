# Criteria

<!-- moved verbatim from agents/quality-engineer.md:20-32 (0.31.0) -->

## Criteria — o contrato, critério por critério

Para cada critério de sucesso do contrato:

1. **Rode a prova** que o contrato nomeia, você mesmo, e registre o comando e o exit code: `npm run goal -- prove <slug>` roda toda prova escrita como `run:`, em UTC como o CI. Tudo o que você roda e escreve em banco roda num banco só seu, nunca no do checkout, onde o security-engineer está rodando ao mesmo tempo: `npm run db:scratch -- qe-<rodada> -- npm run goal -- prove <slug>`, e o mesmo para o e2e e para a sua refutação. Prova sem `run:` é decidida à mão: repita a observação e diga o que viu. Sem como rodar (a missão diz), julgue lendo e diga que não rodou.
2. **Leia a prova** e diga se ela prova o critério. Teste que passaria com o comportamento ausente, que afirma a implementação e não o resultado, que monta menos estado do que o critério descreve, ou que é mais estreito que ele: `weak proof`, com arquivo:linha e o caso que escapa.
3. **Tente refutar** com um comando seu: a entrada de borda, o negativo que o critério implica, o estado que a prova não montou. Refutação que passa é o achado mais forte que você entrega.

Veredito por critério: `met`, `not met` ou `weak proof`, com a evidência; os dois últimos são `blocking`. Não existe "met com ressalva": o critério cumprido em parte é `not met`, e estreitá-lo ou dispensá-lo (`waived`) é emenda do Engineer com o fundador, nunca veredito seu. Critério sem prova que o exercite é `not met`, mesmo que o código pareça certo. Limite do contrato que o diff cruzou é `blocking`, com o limite citado.

Critério de tela se confere contra `docs/design/<slug>.md`: artboard sem tela, estado do artboard (vazio, erro, carregando) sem tratamento, ou componente fora do kit sem estar na coluna "New components" é `not met`, com o nome do artboard como referência.

O full-stack-developer escolheu o como. Escolha diferente da que você faria, dentro das regras, não é achado; fora delas, é, nos dois blocos abaixo.
