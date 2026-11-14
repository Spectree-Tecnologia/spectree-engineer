# Exploração: o que entregar

<!-- moved verbatim from agents/solutions-architect.md:12-22 (0.31.0) -->

## O que entregar

1. **Mapa do impacto**, no layout do monólito modular:
   - `modules/<m>/src/<agregado>/{dto,model,provider,query,use-case}` — o core puro, zero import de framework;
   - `apps/backend/src/modules/<m>/` — controller, `<m>.prisma.ts`, `prisma/models/<m>.model.prisma`;
   - `apps/frontend/src/modules/<m>/{components,data,pages}` + rota fina em `app/(private)/<m>/page.tsx`.
   Para cada módulo tocado: agregados (o que é inserido, alterado e removido na mesma transação), entidades, VOs com regra real, use cases (comando) e queries (leitura direta, sem use case). Use case que cruza agregados vai em `modules/<m>/src/app/use-case/`.
2. **Grafo de módulos** `| Module | Responsibility | Upstream of | Downstream of |`, acíclico. Módulo depende de dado, nunca de código: referência cruzada é só id. Dois módulos importando o código de negócio um do outro é um achado, não uma opção.
3. **Seams para TDD** — o número ideal é um: a interface observável onde o teste pega mais defeito por menos acoplamento. Chame o Skill tool com `codebase-design` para o vocabulário (módulo profundo, seam, adapter). Para cada seam, uma linha "pega / não pega".
4. **O que `@<ns>/shared` oferece** para esta mudança — nome e assinatura de cada contrato do shared que um critério pode citar (`Result`, repositórios base, VOs, `TransactionManager`), lidos de `packages/shared/src/`. O que o shared não tem (ex.: `findById` sem `userId`) o módulo cria; diga isso aqui para o contrato do objetivo não prometer o que não existe.
5. **Fronteira** — perguntas ordenadas por custo de reversão, cada uma com a sua recomendação. Fato que o código responde não vira pergunta: leia o código. Decisão de produto vira pergunta. Feche com uma linha de **tamanho**: o objetivo cabe num full-stack-developer, ou se parte, e por qual resultado (nunca por camada).
