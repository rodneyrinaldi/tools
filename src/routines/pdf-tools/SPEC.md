# Rotina: Ferramentas de PDF

| Campo  | Valor          |
| ------ | -------------- |
| id     | `pdf-tools`    |
| status | beta           |
| autor  | Rodney Rinaldi |

## Objetivo

Aplicar operações em lote a arquivos PDF de uma pasta do computador — juntar, comprimir, converter para A4, proteger e desproteger — filtrando por máscara, opcionalmente nas subpastas, sempre mostrando e confirmando o que será feito antes de executar. Documentos Word (`.docx`) sem PDF correspondente são convertidos para PDF primeiro.

## Comportamento

### 1. Operação

Escolha exclusiva: **Juntar**, **Comprimir**, **Converter para A4**, **Proteger**, **Desproteger**.

### 2. Arquivos

1. **Pasta** (caminho absoluto, ex.: `D:\Documentos\Notas`). É onde os arquivos são procurados e onde os resultados são gravados.
2. **Incluir subpastas**: não (padrão) ou sim.
3. **Máscara** (padrão `*.pdf`): `*` = qualquer sequência, `?` = um caractere, sem diferenciar maiúsculas; várias máscaras separadas por `;`. Comparada só com o nome do arquivo.
4. **Procurar** lista os PDFs encontrados (caminho relativo e tamanho), ordenados por caminho.
5. **DOCX sem PDF:** um `x.docx` cujo `x.pdf` (mesma pasta) não existe e cujo nome `x.pdf` passa na máscara é listado como "DOCX → PDF" e será convertido antes da operação. Arquivos temporários do Word (`~$…`) são ignorados.
6. **Arquivos gerados pela própria rotina** (`*-comprimido.pdf`, `*-a4.pdf`, `*-protegido.pdf`, `*-desprotegido.pdf`, `juntado-*.pdf`) são ignorados, e a quantidade ignorada é informada.
7. Persistem no navegador: operação, pasta, subpastas e máscara (senhas nunca).

### 3. Opções por operação

| Operação    | Opções                                                                     | Saída                                            |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Juntar      | — (ordem = lista exibida; mínimo 2 arquivos)                               | `juntado-AAAAMMDD-HHMMSS.pdf` na pasta informada |
| Comprimir   | nível: **leve** (300 dpi), **médio** (150 dpi, padrão), **forte** (72 dpi) | `nome-comprimido.pdf` ao lado de cada original   |
| A4          | —                                                                          | `nome-a4.pdf` ao lado de cada original           |
| Proteger    | senha + confirmação (mín. 4 caracteres, iguais)                            | `nome-protegido.pdf` (senha para abrir, AES-256) |
| Desproteger | senha atual                                                                | `nome-desprotegido.pdf`                          |

- **A4:** cada página vai para uma página A4 (595 × 842 pt), retrato ou paisagem conforme a página original, com o conteúdo escalado para caber, centralizado e mantendo a proporção; a rotação da página é respeitada.
- **Comprimir:** usa Ghostscript; sem Ghostscript, faz compressão estrutural com qpdf (avisando que o ganho é menor). Se o resultado não ficar menor que o original, ele é descartado e o relatório informa "sem ganho".
- **Proteger/Desproteger:** usam qpdf. A senha nunca vai para a linha de comando (arquivo temporário de argumentos, apagado em seguida).

### 4. Confirmação

Antes de executar, um resumo descreve exatamente o que será feito: operação e opções, quantidade de arquivos, pasta, subpastas e máscara, conversões DOCX → PDF previstas, onde e com que nome as saídas serão gravadas, e a garantia de que nenhum original será alterado. Só executa com **Confirmar e executar**; **Voltar** permite ajustar.

### 5. Execução e relatório

- Processa sequencialmente; mostra "Processando…".
- Relatório por arquivo: ok / sem ganho / erro (com motivo), caminho gerado e, na compressão, tamanho antes → depois (%).
- Totais: sucessos, erros e, na compressão, economia total.
- **Nova operação** volta ao início mantendo pasta e máscara.

### 6. Segurança e garantias

- Originais nunca são alterados, movidos ou apagados.
- Se a saída já existir, grava `nome (2).pdf`, `nome (3).pdf`…
- As operações rodam no servidor Next **local** (Server Actions) e recusam requisições cujo host não seja `localhost`/`127.0.0.1`/`[::1]`.
- Ferramentas ausentes são detectadas e exibidas com o comando de instalação; operações que dependem delas ficam indisponíveis.

## Critérios de aceite

- [x] Máscara com `*`, `?`, `;` e sem diferenciar maiúsculas; rejeita máscara vazia.
- [x] Busca com e sem subpastas, ordenada, ignorando arquivos gerados e temporários do Word.
- [x] DOCX sem PDF correspondente é listado para conversão; com PDF existente, não.
- [x] Nomes de saída com sufixo e numeração quando já existem; juntar usa data e hora.
- [x] Resumo de confirmação descreve operação, opções, arquivos, conversões e destino.
- [x] Juntar preserva a ordem e o total de páginas.
- [x] A4 gera páginas A4 com orientação correta e conteúdo proporcional.
- [x] Comprimir descarta resultado sem ganho.
- [x] Proteger exige senha confirmada; desproteger com senha errada informa erro sem gerar arquivo.
- [x] Ferramentas ausentes são informadas e as operações dependentes desabilitadas.
- [x] Ações recusam host diferente de localhost.
- [x] Originais nunca são alterados.
- [x] Usa componentes e tokens de `@/design-system`.

## Suposições

- O app roda na mesma máquina dos arquivos (`npm run dev` / `npm start`).
- Conversão DOCX → PDF pelo Microsoft Word (automação COM, sem abrir janela); sem Word, pelo LibreOffice (`soffice`) se instalado.
- Caminhos de ferramentas podem ser forçados por variáveis de ambiente: `QPDF_PATH`, `GHOSTSCRIPT_PATH`, `SOFFICE_PATH`.
- Juntar/A4 recriam as páginas: links internos e formulários podem não ser preservados.

## Fora de escopo

- Reordenar arquivos manualmente antes de juntar.
- Restrições de impressão/cópia (só senha para abrir).
- Outros formatos de entrada além de PDF e DOCX.
- Uso remoto (servidor em outra máquina).

## Arquivos

- `index.ts` — manifesto
- `PdfTools.tsx` / `PdfTools.module.css` — UI em etapas
- `mask.ts` — máscara de nomes (puro)
- `naming.ts` — nomes de saída (puro)
- `operations.ts` — tipos, rótulos e resumo de confirmação (puro)
- `storage.ts` — persistência das preferências
- `server/actions.ts` — Server Actions (`"use server"`, só localhost)
- `server/scan.ts` — busca de arquivos
- `server/pdf.ts` — juntar e A4 (pdf-lib)
- `server/tools.ts` — localizar e executar qpdf, Ghostscript, Word/LibreOffice
- `server/run.ts` — execução das operações e relatório
- `*.test.ts(x)` — testes
