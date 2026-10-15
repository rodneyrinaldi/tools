---
name: write-spec
description: Escreve ou atualiza uma spec (SPEC.md de rotina ou spec global em specs/) com objetivo, comportamento, critérios de aceite verificáveis e fora de escopo. Use antes de implementar uma rotina/feature nova, ou quando o usuário pedir para especificar, planejar ou documentar requisitos.
---

# Escrever spec

## Onde fica

- Rotina → `src/routines/<id>/SPEC.md`, a partir de `specs/_routine-template.md`.
- Feature transversal (hub, design system, infra) → `specs/NNN-titulo.md`, a partir de `specs/_template.md`, numeração sequencial.
- Decisão de arquitetura com alternativas descartadas → `docs/adr/NNNN-titulo.md`.

## Como escrever

1. Leia o código e as specs relacionadas antes; não invente comportamento existente.
2. **Objetivo** em 1–3 frases: qual problema do usuário resolve.
3. **Comportamento** numerado, observável pelo usuário (entradas → saídas, estados vazios, erros).
4. **Critérios de aceite** como checklist `- [ ]`, cada um verificável por teste ou inspeção. Inclua ao menos um de acessibilidade e um de uso do design system.
5. **Fora de escopo** explícito para evitar crescimento silencioso.
6. Pergunte ao usuário apenas lacunas que mudam o comportamento; registre suposições na seção "Suposições".
7. Texto em pt-BR, conciso.

## Ciclo de vida

- Ao implementar, marque `- [x]` conforme os testes passarem.
- Mudou o comportamento? Atualize a spec **no mesmo commit**.
