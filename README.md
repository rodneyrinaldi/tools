# Tools

Hub de rotinas utilitárias em **uma única tela**, feito com Next.js 16 (App Router, TypeScript) e um design system próprio, escuro e translúcido.

Cada rotina vive em `src/routines/<id>/` e tem o **próprio README** com instruções de uso. Este documento cobre apenas o ambiente, a arquitetura e o design system.

## Ambiente

**Requisitos:** Node 24 (`.nvmrc`) e npm.

```bash
nvm use
npm install
npm run dev    # http://localhost:3000
```

Uma rotina abre direto pelo hash da URL: `http://localhost:3000/#<id-da-rotina>`.

### Scripts

| Script               | O que faz                                |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento              |
| `npm run build`      | Build de produção                        |
| `npm run start`      | Serve o build de produção                |
| `npm run check`      | typecheck + lint + format:check + testes |
| `npm run test:watch` | Testes em modo watch                     |
| `npm run format`     | Formata com Prettier                     |

### Ferramentas

- **TypeScript** estrito, alias `@/*` → `src/*`.
- **ESLint** (config do Next) e **Prettier** (`.prettierrc.json`, `.editorconfig`).
- **Vitest** + Testing Library (jsdom). Testes ficam ao lado do código: `*.test.ts(x)`.
- **CI** no GitHub Actions (`.github/workflows/ci.yml`): `npm run check` + `npm run build`.
- **VS Code:** extensões recomendadas e formatação ao salvar em `.vscode/`.

## Arquitetura

```
src/app/              página única e layout (server components finos)
src/components/hub/   tela de seleção (RoutineHub) e moldura das rotinas (RoutineStage)
src/design-system/    tokens, base e componentes compartilhados
src/hooks/            hooks compartilhados (useHashRoute)
src/routines/
  types.ts            contrato RoutineManifest
  registry.ts         rotinas registradas, na ordem de exibição
  <id>/               uma pasta por rotina: README.md, SPEC.md, manifesto, UI, lógica, testes
specs/                specs globais e templates (spec e README de rotina)
docs/adr/             decisões de arquitetura
.claude/              settings, hooks, skills e agentes do Claude Code
```

- **Tela única:** a navegação entre lista e rotina usa o hash da URL; não há outras rotas.
- **Rotinas isoladas:** uma rotina não importa outra; o que for comum vai para `design-system`, `hooks` ou `lib`.
- **Carregamento sob demanda:** cada rotina é carregada com `React.lazy` só quando aberta.
- **Guarda de estrutura:** `registry.test.ts` falha se uma pasta não estiver registrada ou se faltar `README.md`, `SPEC.md` ou testes.

Detalhes e alternativas consideradas: [ADR 0001](docs/adr/0001-arquitetura-de-rotinas.md).

## Design system

Escuro, elegante e translúcido ("glass"): fundo quase preto com brilhos radiais suaves e conteúdo em painéis de vidro com desfoque. Fonte: `src/design-system/` · Spec: [002](specs/002-design-system.md).

### Tokens

Definidos em `src/design-system/tokens.css` como variáveis CSS `--ds-*`:

| Grupo       | Exemplos                                                                         |
| ----------- | -------------------------------------------------------------------------------- |
| Cores       | `--ds-color-bg`, `--ds-color-text(-muted/-subtle)`, `--ds-color-accent(-2/-3)`   |
| Vidro       | `--ds-glass-bg(-hover/-strong)`, `--ds-glass-border(-strong)`, `--ds-glass-blur` |
| Tipografia  | `--ds-font-sans/-mono`, `--ds-text-xs` … `--ds-text-2xl`                         |
| Espaço      | `--ds-space-1` … `--ds-space-8` (escala de 4px)                                  |
| Raio/sombra | `--ds-radius-sm/md/lg/full`, `--ds-shadow-sm/md/glow`                            |
| Movimento   | `--ds-duration(-fast)`, `--ds-ease` (zerados com `prefers-reduced-motion`)       |

### Componentes

Importados sempre de `@/design-system`:

| Componente         | Uso                                        |
| ------------------ | ------------------------------------------ |
| `Surface`          | painel de vidro; base de cards e seções    |
| `Button`           | ações (`primary`, `secondary`, `ghost`)    |
| `Badge`            | status e etiquetas                         |
| `TextField`        | campo de texto com label e dica acessíveis |
| `TextArea`         | texto longo com label e dica               |
| `SegmentedControl` | escolha exclusiva entre poucas opções      |
| `cx`               | concatena classes condicionais             |

### Regras

- Estilos em **CSS Modules** ao lado do componente, usando **somente tokens** `var(--ds-*)`.
- Componente reutilizável por mais de uma rotina vai para `src/design-system/components/` e é exportado em `index.ts`.
- Foco visível e contraste AA em todos os controles.

Referência completa: `.claude/skills/design-system/SKILL.md`.

## Criando uma rotina

1. Escreva a spec em `src/routines/<id>/SPEC.md` ([template](specs/_routine-template.md)).
2. Crie a pasta com manifesto, componente, lógica pura, testes e `README.md` ([template](specs/_routine-readme-template.md)).
3. Registre em `src/routines/registry.ts`.
4. Rode `npm run check`.

Com o Claude Code, a skill `/new-routine` faz esse fluxo.

## Desenvolvendo com Claude Code

- `CLAUDE.md`: arquitetura, regras e fluxo de trabalho.
- Skills do projeto: `/new-routine`, `/write-spec`, `/design-system`.
- Subagente `routine-reviewer` para revisar antes do commit.
- Hook formata com Prettier cada arquivo editado pelo Claude.
