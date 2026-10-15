# 002 — Design system escuro com transparências

| Campo  | Valor      |
| ------ | ---------- |
| status | feita      |
| data   | 2026-10-15 |

## Objetivo

Linguagem visual única, escura e elegante, com superfícies de vidro translúcido, compartilhada por todas as rotinas.

## Estrutura

- `src/design-system/tokens.css` — variáveis `--ds-*` (cores, glass, tipografia, espaço, raio, sombra, movimento).
- `src/design-system/base.css` — reset, fundo com brilhos radiais, foco visível.
- `src/design-system/components/` — `Surface`, `Button`, `Badge`, `TextField`, `TextArea`, `SegmentedControl`.
- `src/design-system/index.ts` — única porta de entrada (`@/design-system`).

## Critérios de aceite

- [x] Tokens centralizados; componentes não usam cores literais fora dos tokens.
- [x] `Surface` com blur, borda translúcida e reflexo.
- [x] Foco visível em todos os controles (`--ds-focus-ring`).
- [x] `prefers-reduced-motion` zera as durações.
- [x] Tema declarado como escuro (`color-scheme: dark`, `themeColor`).

## Regras de uso

Ver `.claude/skills/design-system/SKILL.md`.

## Fora de escopo

- Tema claro.
- Biblioteca de ícones (usar emoji por enquanto).
