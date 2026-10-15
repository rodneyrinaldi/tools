# 👋 Olá Mundo

Rotina de exemplo: cumprimenta você pelo nome. Serve de modelo para criar novas rotinas.

- **Acesso:** `/#hello-world`
- **Status:** estável
- **Spec:** [SPEC.md](./SPEC.md)

## Como usar

1. Abra a rotina: a saudação mostra **"Olá, mundo!"**.
2. Digite seu nome no campo **Seu nome** — a saudação muda para **"Olá, {nome}!"**.
3. **Limpar** apaga o nome e volta para a saudação padrão.

## Para desenvolvedores

| Arquivo               | Responsabilidade           |
| --------------------- | -------------------------- |
| `index.ts`            | manifesto da rotina        |
| `HelloWorld.tsx`      | UI (usa `@/design-system`) |
| `greeting.ts`         | lógica pura da saudação    |
| `HelloWorld.test.tsx` | testes da lógica e da UI   |

Use esta pasta como referência mínima da estrutura de uma rotina.
