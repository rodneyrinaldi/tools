---
name: new-routine
description: Cria uma nova rotina no hub de ferramentas (pasta própria em src/routines, manifesto, componente, CSS module, README.md, SPEC.md, testes e registro). Use quando o usuário pedir para adicionar, criar ou iniciar uma nova rotina/ferramenta/utilitário.
---

# Nova rotina

Siga os passos na ordem. Use `src/routines/hello-world/` como referência viva.

## 1. Definir identidade

- `id`: kebab-case, curto, em inglês (ex.: `json-formatter`). Será o nome da pasta e o hash da URL.
- `title` (pt-BR), `description` (1 frase), `icon` (1 emoji), `status` (`experimental` para rotinas novas).
- Confirme que o id não existe em `src/routines/registry.ts`.

## 2. Spec antes do código

Se ainda não houver spec, crie `src/routines/<id>/SPEC.md` a partir de `specs/_routine-template.md` (ou rode a skill `/write-spec`). Liste **critérios de aceite verificáveis**. Pergunte ao usuário só o que for realmente ambíguo.

## 3. Arquivos da pasta `src/routines/<id>/`

```
index.ts               # manifesto (default export)
<Nome>.tsx             # componente raiz, "use client", default export
<Nome>.module.css      # estilos só com tokens var(--ds-*)
<logica>.ts            # funções puras (quando houver lógica)
<Nome>.test.tsx        # testes da lógica e da UI
SPEC.md
README.md              # guia de uso (template: specs/_routine-readme-template.md)
```

Manifesto:

```ts
import { lazy } from "react";
import type { RoutineManifest } from "../types";

const routine: RoutineManifest = {
  id: "<id>",
  title: "<Título>",
  description: "<Uma frase.>",
  icon: "<emoji>",
  status: "experimental",
  component: lazy(() => import("./<Nome>")),
};

export default routine;
```

## 4. Registrar

Importe o manifesto em `src/routines/registry.ts` e adicione ao array `routines` na posição desejada.

## 5. Regras

- Use componentes de `@/design-system`; não recrie botões, campos ou painéis.
- Não importe nada de outra rotina. Se algo for útil para várias rotinas, mova para `src/design-system`, `src/hooks` ou `src/lib`.
- Não crie rotas em `src/app` — a tela é única.
- O componente é renderizado dentro de `RoutineStage` (já tem título, voltar e um `Surface`). Não repita título nem moldura.

## 6. Validar

1. `npm run check` (o `registry.test.ts` garante pasta ↔ registro, README.md, SPEC.md e teste presentes).
2. `npm run dev` e abra `http://localhost:3000/#<id>` para conferir visualmente.
3. Marque os critérios atendidos no `SPEC.md`.
4. Escreva/atualize o `README.md` da rotina: como usar, atalhos, dicas e tabela de arquivos. Não adicione a rotina ao README da raiz (ele é genérico).
