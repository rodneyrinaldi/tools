@AGENTS.md

# Tools — guia para o Claude Code

Aplicação Next.js (App Router, TypeScript estrito) com **uma única tela** que lista **rotinas** utilitárias. Cada rotina vive em pasta própria e usa o **design system escuro com transparências** compartilhado.

## Comandos

| Ação               | Comando             |
| ------------------ | ------------------- |
| Dev server         | `npm run dev`       |
| Validação completa | `npm run check`     |
| Tipos              | `npm run typecheck` |
| Lint               | `npm run lint`      |
| Testes             | `npm run test`      |
| Formatar           | `npm run format`    |
| Build de produção  | `npm run build`     |

Antes de declarar uma tarefa concluída, rode `npm run check` e informe o resultado real.

## Mapa do código

```
src/
  app/                 # layout + página única (server components finos)
  components/hub/      # RoutineHub (tela única), RoutineCard, RoutineStage
  design-system/       # tokens.css, base.css, componentes (Surface, Button, Badge, TextField)
  hooks/               # hooks compartilhados (useHashRoute)
  routines/
    types.ts           # contrato RoutineManifest
    registry.ts        # lista ordenada de rotinas
    <id>/              # UMA pasta por rotina (ver regras abaixo)
specs/                 # specs globais + template de spec de rotina
docs/adr/              # decisões de arquitetura
.claude/skills/        # skills do projeto (/new-routine, /design-system, /write-spec)
.claude/agents/        # subagentes (routine-reviewer)
```

## Regras de arquitetura (obrigatórias)

1. **Tela única.** Não crie novas rotas em `src/app`. A navegação entre rotinas é feita pelo hash da URL (`/#<id>`) via `useHashRoute`.
2. **Uma pasta por rotina** em `src/routines/<id>/`, com `id` em kebab-case igual ao nome da pasta. Conteúdo mínimo:
   - `index.ts` — exporta `default` um `RoutineManifest` com `component: lazy(() => import("./Componente"))`
   - `Componente.tsx` + `Componente.module.css`
   - `SPEC.md` — spec da rotina (template em `specs/_routine-template.md`)
   - `README.md` — guia de uso da rotina (template em `specs/_routine-readme-template.md`)
   - `*.test.tsx` — testes
3. **Isolamento.** Uma rotina não importa nada de outra rotina. Código compartilhado sobe para `src/design-system`, `src/hooks` ou `src/lib`.
4. **Registro.** Toda rotina é adicionada em `src/routines/registry.ts`. O teste `registry.test.ts` falha se pasta e registro divergirem ou se faltar `README.md`/`SPEC.md`/teste.
5. **Tela cheia:** uma rotina pode cobrir a tela toda (ex.: modo foco do teleprompter) renderizando via `createPortal` em `document.body` — nunca com `position: fixed` dentro do `Surface`, cujo `backdrop-filter` prende elementos fixos.
6. **Lógica pura separada** da UI (ex.: `greeting.ts`) para ser testada sem renderizar.

## Design system

- Importe sempre de `@/design-system` (`Surface`, `Button`, `Badge`, `TextField`, `TextArea`, `SegmentedControl`, `cx`).
- Estilos com **CSS Modules** usando apenas tokens `var(--ds-*)` de `src/design-system/tokens.css`. Nada de cores/espaçamentos literais nas rotinas.
- Precisa de um componente novo e reutilizável? Crie em `src/design-system/components/` e exporte no `index.ts` — não dentro da rotina. Detalhes: skill `/design-system`.

## Convenções

- Código e identificadores em inglês; textos de UI, specs e docs em **português (pt-BR)**.
- Componentes interativos levam `"use client"`; mantenha `src/app` como server components.
- Acessibilidade: elementos semânticos, `label` em todo input, foco visível (já vem do DS), `aria-live` para resultados dinâmicos.
- Next.js 16 com `cacheComponents` — consulte `node_modules/next/dist/docs/` antes de usar APIs do framework.

## Fluxo de trabalho (spec-driven)

1. **Spec primeiro:** `/write-spec` cria/atualiza o `SPEC.md` com critérios de aceite.
2. **Implementar:** `/new-routine` faz o scaffold seguindo as regras acima.
3. **Validar:** `npm run check`; para mudanças visuais, abra `npm run dev` e confira.
4. **Revisar:** use o subagente `routine-reviewer` antes de commitar.
5. Marque os critérios atendidos no `SPEC.md` e mantenha o `README.md` da rotina atualizado.

## Documentação

- `README.md` da raiz: **genérico** — ambiente, arquitetura e design system. Não descreva rotinas nele.
- `src/routines/<id>/README.md`: como usar a rotina (passos, atalhos, dicas) + tabela de arquivos para desenvolvedores.
- `src/routines/<id>/SPEC.md`: requisitos e critérios de aceite.

Commits: mensagens no imperativo, em pt-BR, prefixo convencional (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
