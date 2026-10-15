# Rotina: Olá Mundo

| Campo  | Valor          |
| ------ | -------------- |
| id     | `hello-world`  |
| status | stable         |
| autor  | Rodney Rinaldi |

## Objetivo

Rotina de referência. Demonstra o contrato de rotinas, o uso do design system e o padrão de testes. Serve de modelo para novas rotinas.

## Comportamento

1. Exibe a saudação **"Olá, mundo!"** em destaque.
2. Campo de texto "Seu nome": ao digitar, a saudação muda para **"Olá, {nome}!"** (nome sem espaços nas pontas).
3. Nome vazio ou só com espaços → volta para "Olá, mundo!".
4. Botão "Limpar" apaga o nome; fica desabilitado quando o campo está vazio.

## Critérios de aceite

- [x] Saudação padrão "Olá, mundo!" ao abrir.
- [x] Saudação personalizada ao digitar.
- [x] "Limpar" restaura a saudação padrão.
- [x] Saudação anunciada para leitores de tela (`aria-live="polite"`).
- [x] Usa apenas componentes/tokens de `@/design-system`.

## Fora de escopo

- Persistência do nome.
- Internacionalização.

## Arquivos

- `index.ts` — manifesto
- `HelloWorld.tsx` / `HelloWorld.module.css` — UI
- `greeting.ts` — lógica pura
- `HelloWorld.test.tsx` — testes
