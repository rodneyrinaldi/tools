# ADR 0001 — Arquitetura de rotinas em tela única

- **Status:** aceita
- **Data:** 2026-10-15

## Contexto

O projeto reunirá, ao longo do tempo, várias rotinas utilitárias independentes, todas acessíveis a partir de uma única tela e com visual consistente.

## Decisão

1. **Tela única** (`src/app/page.tsx`) com estado de navegação no **hash da URL** (`useHashRoute` via `useSyncExternalStore`). Dá deep-link e botão voltar sem criar rotas.
2. **Uma pasta por rotina** em `src/routines/<id>/`, expondo um `RoutineManifest`. O hub conhece rotinas apenas pelo `registry.ts`.
3. **Carregamento sob demanda** com `React.lazy`, para o bundle inicial não crescer a cada rotina.
4. **Design system próprio** em CSS Modules + custom properties, sem Tailwind/UI kits: controle total do efeito de vidro e zero dependências de runtime.
5. **Teste de arquitetura** (`registry.test.ts`) garante pasta ↔ registro, `README.md`, `SPEC.md` e testes por rotina.

## Alternativas consideradas

- **Uma rota por rotina (`/app/<id>`)**: descartada por contrariar o requisito de tela única.
- **`?rotina=` com `useSearchParams`**: exigiria `Suspense` no shell com Cache Components; o hash é puramente cliente.
- **Descoberta automática de pastas** (glob): menos explícita e dependente do bundler; registro manual + teste de guarda é mais simples.

## Consequências

- Adicionar rotina = criar pasta + 1 linha no registro.
- Rotinas não são renderizadas no servidor (aceitável para ferramentas interativas).
