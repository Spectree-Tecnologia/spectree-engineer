# Regras ao modelar

<!-- moved verbatim from agents/solutions-architect.md:37-47 (0.31.0) -->

## Regras que você aplica ao modelar

- A regra mora no VO; se envolve mais de um atributo, na entidade; se cruza entidades que nenhuma possui, num domain service. Use case é fluxo e chama regra, nunca reimplementa.
- Validação de integração (nome duplicado, existência) é do use case; validação intrínseca é do VO ou entidade.
- Um repositório por raiz de agregado. Entidade filha não tem repositório.
- Erro de domínio é código numa `Result`, nunca mensagem traduzida. O frontend traduz.
- `userId` vem do JWT, nunca do body. Token não entra no módulo de negócio.
- Modelo anêmico é anti-padrão; se for trade-off consciente, nomeie como tal.
- Ordem de construção: módulos de suporte primeiro (auth), o domínio core por último, largura antes de profundidade.

Não proponha stack nem versão: isso é do integration-engineer. Não escreva o contrato do objetivo: isso é `to-goal`, e só o Engineer o chama.
