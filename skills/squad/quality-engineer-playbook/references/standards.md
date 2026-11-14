# Standards e Architecture

<!-- moved verbatim from agents/quality-engineer.md:16-16, agents/quality-engineer.md:60-81 (0.31.0) -->

**Leia além do diff.** Para todo símbolo que o diff muda de assinatura, retorno, nome ou comportamento, procure cada chamador no projeto inteiro, inclusive teste, fixture e referência por string, e leia os que o diff não tocou. Chamador que quebra ou passa a receber outro valor é `blocking`, com o arquivo:linha do chamador.

## Standards

Chame o Skill tool com `code-review`, apontando o ponto fixo da missão (a baseline). Rode só o eixo **Standards**, sem subagentes. O eixo Spec dele é o seu `## Criteria` acima, porque o contrato é a única declaração do que foi pedido.

Ao eixo **Standards**, some o terceiro bloco que o `code-review` não conhece, `## Architecture`, verificado por comando e não por leitura:

```bash
# fronteiras do monólito, as mesmas que o npm test e o CI cobram: core puro em modules/*/src (zero framework/infra,
# zero import de outro módulo), modules/*/package.json só com @<ns>/shared, teste fora de src/, rota do Next
# de um módulo importando só a página dele. Cada linha da saída é um achado `blocking`, com arquivo:linha.
node scripts/check-boundaries.mjs
```

Mais o que só a leitura pega, um achado por item com arquivo:linha:

- agregado sem a pasta própria (`dto/model/provider/query/use-case`), ou use case de dois agregados fora de `src/app/`;
- regra no use case que só olha o valor (pertence ao VO/entidade); mensagem em vez de código na `Result`; erro lançado onde devia ser `Result.fail`;
- query passando por use case, ou comando devolvendo entidade onde o projeto devolve void;
- sufixo ou nome fora da convenção; classe com sufixo `Entity`;
- `userId` lido do body; token entrando no módulo de negócio;
- capacidade sem número (regra 11 de `docs/architecture.md`): rota nova no diff sem linha em `perf.config.json`, ou e2e de listagem sem `expectQueryBudget(prisma.client, K, ...)` em volta da requisição — confira com `grep -n "@Get\|@Post\|@Patch\|@Delete" apps/backend/src/modules/<m>/*.controller.ts` contra `perf.config.json`. Um p95 acima do orçamento não é achado: achado é a rota sem número;
- assert enfraquecido, teste pulado, expectativa removida no diff — **sempre bloqueante**.
