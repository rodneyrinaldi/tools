# ADR 0002 — Rotinas com acesso a arquivos locais

- **Status:** aceita
- **Data:** 2026-10-15

## Contexto

A rotina de PDF precisa ler e gravar arquivos em pastas do computador (`D:\…`), varrer subpastas e chamar programas externos (qpdf, Ghostscript, Microsoft Word). O navegador não tem acesso livre ao sistema de arquivos, e o ADR 0001 proíbe novas rotas em `src/app`.

## Decisão

1. O trabalho com arquivos roda no **servidor Next local**, por **Server Actions** em `src/routines/<id>/server/actions.ts` (`"use server"`), importadas pelo componente da rotina. Nenhuma rota nova é criada: a tela continua única.
2. Toda ação verifica o cabeçalho `Host` e **só aceita `localhost`/`127.0.0.1`/`[::1]`**. Server Actions são endpoints POST acessíveis diretamente, então a checagem fica dentro de cada ação.
3. Arquivos `"use server"` exportam **apenas** as ações. Auxiliares ficam em módulos comuns (`server/*.ts`), testáveis em ambiente Node.
4. Programas externos são chamados com `execFile` (sem shell), com tempo limite. Segredos (senhas) vão por arquivo temporário de argumentos, nunca pela linha de comando.
5. Ferramentas externas são **detectadas** (PATH, pastas de instalação comuns, variáveis de ambiente) a cada uso; a UI informa o que falta e bloqueia só as operações afetadas.
6. Originais nunca são alterados; saídas usam nomes novos (`nome (2).pdf` quando necessário).

## Alternativas consideradas

- **Route Handler (`/api/...`)**: contraria a regra de tela única/sem rotas novas; Server Actions dão o mesmo resultado com tipagem ponta a ponta.
- **File System Access API no navegador**: exige escolher pastas por diálogo (sem caminho digitado), não funciona em todos os navegadores e não executa programas externos.
- **Só bibliotecas JavaScript**: compressão fraca (não reduz imagens) e criptografia/descriptografia menos confiáveis que qpdf/Ghostscript.

## Consequências

- Essas rotinas funcionam apenas com o app rodando na mesma máquina dos arquivos (`npm run dev`/`npm start`); num deploy remoto, as ações recusam o acesso.
- Testes de servidor rodam em ambiente Node (`// @vitest-environment node`); os que dependem de ferramentas externas são pulados quando elas não estão instaladas.
