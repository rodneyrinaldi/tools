---
name: design-system
description: Regras e referência do design system escuro com transparências (glass) do projeto — tokens, componentes Surface/Button/Badge/TextField e como estendê-lo. Use ao estilizar qualquer tela ou rotina, criar componentes visuais ou alterar tokens.
---

# Design system — escuro, elegante, translúcido

Fonte: `src/design-system/`. Spec: `specs/002-design-system.md`.

## Princípios

1. **Escuro e calmo:** fundo quase preto (`--ds-color-bg`) com brilhos radiais suaves; o conteúdo flutua em vidro.
2. **Vidro, não opacidade:** superfícies usam `--ds-glass-bg*` + `backdrop-filter: blur(var(--ds-glass-blur))` + borda `--ds-glass-border`.
3. **Um acento:** violeta (`--ds-color-accent`) para ação/destaque; ciano (`--ds-color-accent-2`) em gradientes decorativos e respiros; rosa (`--ds-color-accent-3`) reservado a anotações/indicações que não fazem parte do conteúdo. Anotações nunca usam a cor do texto principal.
4. **Hierarquia por texto:** `--ds-color-text` → `-muted` → `-subtle`.
5. **Movimento curto:** `--ds-duration(-fast)` + `--ds-ease`; respeita `prefers-reduced-motion` automaticamente.

## Componentes (`import { ... } from "@/design-system"`)

| Componente         | Uso                                           | Props principais                                                             |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `Surface`          | Painel de vidro; base de cards e seções       | `as`, `padding: none\|sm\|md\|lg`, `variant: default\|strong`, `interactive` |
| `Button`           | Ações                                         | `variant: primary\|secondary\|ghost`, `size: sm\|md`                         |
| `Badge`            | Status/etiquetas                              | `tone: neutral\|accent\|success\|warning`                                    |
| `TextField`        | Input com label e dica acessíveis             | `label` (obrigatório), `hint`, demais props de `<input>`                     |
| `TextArea`         | Texto longo com label e dica                  | `label` (obrigatório), `hint`, `ref`, demais props de `<textarea>`           |
| `SegmentedControl` | Escolha exclusiva entre poucas opções (radio) | `label`, `options`, `value`, `onChange`                                      |
| `cx`               | Concatena classes condicionais                | —                                                                            |

## Regras para estilos

- CSS Modules (`Arquivo.module.css`) ao lado do componente.
- **Somente tokens** `var(--ds-*)` para cor, espaço, raio, sombra, fonte, duração. Valores literais só para dimensões pontuais de layout (ex.: `min-height: 180px`).
- Não sobrescreva estilos internos dos componentes do DS por seletores aninhados; passe `className` para layout (margem, grid) apenas.
- Um `primary` por área de ação.

## Estendendo

- **Novo token:** adicione em `tokens.css` com prefixo `--ds-`, comentado na seção certa, e documente na spec.
- **Novo componente:** só quando for reutilizável por mais de uma rotina. Crie `components/Nome.tsx` + `Nome.module.css`, aceite `className`, encaminhe props nativas, exporte em `index.ts`, adicione à tabela acima e à spec.
- Garanta foco visível e contraste AA (texto sobre vidro testado sobre o fundo mais claro dos brilhos).
