# O design system

<!-- moved verbatim from agents/ui-ux-designer.md:14-14, agents/ui-ux-designer.md:61-63 (0.31.0) -->

**Na primeira mudança com tela do projeto — o design system.** Publique um artefato do tipo *Design System* (o quickstart do Artifact tool com `intent: "other"` lista o tipo) a partir do que o projeto já tem em `apps/frontend/src/shared/`: o UI kit em `components/ui/` (shadcn-style sobre Tailwind 4), ícones `lucide-react`, toasts `sonner`, o `AdminShell` único (a navegação, `NAVIGATION_SECTIONS`, fica em `app/(private)/layout.tsx`, nunca em `shared/`), os grupos de rota `(public)`/`(private)`, o validador de formulário `v` em `shared/components/form/validator/`. O tipo Design System exige `components/index.d.ts`; o Artifact tool recusa `.ts`, então publique esse arquivo com `contentType: "text/plain"`. Tokens, tipografia, espaçamento e os componentes que existem. Grave a URL em `docs/design/design-system.md`. Um por projeto; nas mudanças seguintes, leia-o e use-o.

## Republicar o design system

Quando um objetivo acrescenta ou muda componente do kit, o Engineer te despacha no fim dele só para isto: publicar de novo o artefato do design system a partir de `docs/design/design-system/project/`. Pronto quando os arquivos publicados são os do disco: liste o artefato (`scope: "files"`), compare arquivo por arquivo com a pasta, e relate os que diferiam. Artefato atrás do disco faz o próximo protótipo nascer sobre um kit que não existe.
