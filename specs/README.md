# Specs

Desenvolvimento orientado a especificação: **nenhuma rotina ou feature é implementada sem spec**.

| Tipo                 | Local                         | Template                            |
| -------------------- | ----------------------------- | ----------------------------------- |
| Spec de rotina       | `src/routines/<id>/SPEC.md`   | `specs/_routine-template.md`        |
| README de rotina     | `src/routines/<id>/README.md` | `specs/_routine-readme-template.md` |
| Spec global/feature  | `specs/NNN-titulo.md`         | `specs/_template.md`                |
| Decisão arquitetural | `docs/adr/NNNN-titulo.md`     | ADR 0001 como modelo                |

## Índice

- [001 — Hub de rotinas (tela única)](./001-hub.md)
- [002 — Design system](./002-design-system.md)

### Rotinas

- [teleprompter — Teleprompter](../src/routines/teleprompter/SPEC.md)
- [hello-world — Olá Mundo](../src/routines/hello-world/SPEC.md)

## Ciclo

1. Escrever a spec (`/write-spec`) com critérios de aceite verificáveis.
2. Implementar (`/new-routine` para rotinas).
3. Marcar critérios atendidos (`- [x]`) quando os testes passarem.
4. Mudança de comportamento ⇒ atualizar a spec no mesmo commit.
