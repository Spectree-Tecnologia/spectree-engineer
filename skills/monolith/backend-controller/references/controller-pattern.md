# Controller Pattern

## Paths de referência

- Controllers: `apps/backend/src/modules/<m>/<m>.controller.ts` (o `config-new-module` gera o primeiro).
- Segurança (gerada pelo `config-shared-backend`):
  - `apps/backend/src/shared/auth/jwt.guard.ts` — `JwtGuard`, registrado como `APP_GUARD`: toda rota fechada por padrão
  - `apps/backend/src/shared/decorators/public.decorator.ts` — `@Public()` abre uma rota
  - `apps/backend/src/shared/decorators/current-user.decorator.ts` — `@CurrentUser()` / `@CurrentUser('id')`
  - `apps/backend/src/shared/errors/api-exception.filter.ts` — envelope de erro único

## Papel do controller

- Converter HTTP request em input para use case.
- Controlar autenticação/autorização e status HTTP.
- Traduzir `Result` do dominio em resposta ou exceção Nest.

## Checklist de implementação

- [ ] `@Controller('rota-base')` definido.
- [ ] Decorators de método HTTP corretos (`@Get`, `@Post`, `@Patch`, `@Delete`).
- [ ] `@Public()` só em rota realmente aberta; `userId` sempre de `@CurrentUser('id')`.
- [ ] Inputs extraídos por `@Body/@Param/@Query`.
- [ ] Normalização básica de tipos feita no controller (page/pageSize/bool string).
- [ ] Falhas mapeadas para exceções HTTP coerentes:
  - `BadRequestException` (400)
  - `UnauthorizedException` (401)
  - `NotFoundException` (404)
  - `InternalServerErrorException` (500)
- [ ] Resposta final segue contrato do endpoint (payload, vazio, 201/204 etc.).

## Padrões observados no código

- Controller instancia/chama use case e não executa regra de domínio.
- Nenhum `@UseGuards` por controller: o guard JWT é global; permissão por papel, quando o projeto tiver, entra como guard próprio sobre `@CurrentUser()`.
- Listagens paginadas recebem `page/pageSize` como query string e fazem parsing.

## Armadilhas comuns

- Colocar regra de domínio no controller.
- Acoplar controller a detalhes de infraestrutura desnecessários.
- Não normalizar query params numéricos/booleanos.
- Expor erro cru sem envelope de `errors` quando padrão do módulo exige.
