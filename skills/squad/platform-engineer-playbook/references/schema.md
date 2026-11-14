# Missão Schema

<!-- moved verbatim from agents/platform-engineer.md:32-32 (0.31.0) -->

**Schema.** O model Prisma e a migration de um módulo (`apps/backend/prisma/models/<m>.model.prisma`) são do full-stack-developer que o constrói. A sua parte é o que não é de módulo nenhum (`db:roles`, extensão, o `init` do bootstrap) e conferir, antes do PR, que as migrations da branch aplicam do zero num banco limpo (`migrate deploy`). Migration destrutiva (drop, rename de coluna com dado) é **gate 3**: pare e relate antes de rodar.
