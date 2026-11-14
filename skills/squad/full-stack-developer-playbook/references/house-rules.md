# As regras que a verificação vai cobrar

<!-- moved verbatim from agents/full-stack-developer.md:45-60 (0.31.0) -->

## As regras que a verificação vai cobrar

O estilo da casa não se negocia; o caminho dentro dele é seu. Preferência sua contra uma regra escrita não é decisão: é achado `blocking`. O `node scripts/check-boundaries.mjs` é o juiz das fronteiras.

- **Três caminhos, e só eles:** `modules/<m>/` (core puro: zero Nest, Next, React, Prisma), `apps/backend/src/modules/<m>/`, `apps/frontend/src/modules/<m>/`. A pasta de rotas do Next só importa a página do módulo.
- **O agregado é a pasta:** `dto/`, `model/` (`*.entity.ts`, `*.vo.ts`), `provider/` (`*.repository.ts`), `query/` (`*.query.ts`), `use-case/`. O que dois agregados compartilham sobe para `src/app/`.
- **A regra mora no modelo, o fluxo chama.** Só olha o valor → VO ou entidade. Precisa perguntar ao mundo → use case. Validação barata antes de tocar infra.
- **Comando passa por use case e devolve void; query não passa** — `*.query.ts` devolve DTO e o controller chama direto. Página máxima 50.
- **Entidade:** `tryCreate` devolve `Result` combinando os VOs; `create` = `tryCreate` + `throwsIfFailed`; props congeladas, mudança por `cloneWith`; identidade por `Id.create`; `toJSON()` devolve as props.
- **Erro é código numa `Result`** (`Result.fail('ACCOUNT_NOT_FOUND')`), nunca mensagem. `ResultError` só quando parar é obrigatório. Use o formato de código que o projeto já usa; dois formatos no projeto é bloqueio relatado, não escolha sua.
- **Módulo depende de dado, não de código.** `modules/<m>/package.json` depende só de `@<ns>/shared`; referência a outro módulo é id.
- **Nomes:** kebab-case nos arquivos, sufixos `*.entity.ts`, `*.vo.ts`, `*.repository.ts`, `*.query.ts`, `*.use-case.ts`, `*.prisma.ts`, `*.controller.ts`, `*.schema.ts`; classes sem sufixo (`User`, não `UserEntity`); use case como verbo (`AuthenticateUser`).
- **Controller fino:** injeta o adapter concreto, instancia o use case à mão, mapeia falha para 400/401/404/500. `userId` vem do JWT.
- **Capacidade tem número** (regra 11): rota nova ganha a sua linha em `perf.config.json`, e o e2e de listagem roda dentro de `expectQueryBudget`. Trava por pessoa: `actors` no setup do perf.
- **O menor código que cumpre o critério** (regra 15): nada de abstração, opção ou código "para depois" que nenhum critério, limite ou regra pede. Enxuto na solução, nunca na mudança: chamador, teste e fixture que ela quebra são parte dela. Atalho consciente leva o comentário `shortcut: <o limite>, <quando subir>`, e nunca adia o que a regra 15 proíbe cortar.
- **Nunca afrouxe uma expectativa para obter um verde.** Teste que precisou mudar por import movido ou fixture: diga por quê, por arquivo. Assert enfraquecido, pulado ou apagado é bloqueio relatado.
