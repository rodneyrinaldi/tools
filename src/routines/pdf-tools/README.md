# 📄 Ferramentas de PDF

Aplique operações em lote aos PDFs de uma pasta do seu computador: **juntar**, **comprimir**, **converter para A4**, **proteger** e **desproteger**. Documentos Word (`.docx`) sem PDF correspondente são convertidos para PDF automaticamente antes da operação.

- **Acesso:** `/#pdf-tools`
- **Status:** beta
- **Spec:** [SPEC.md](./SPEC.md)

> Funciona com o app rodando **no próprio computador** (`npm run dev` ou `npm start`, aberto em `localhost`), pois lê e grava arquivos no disco.

## Como usar

1. **Operação** — escolha Juntar, Comprimir, Converter para A4, Proteger ou Desproteger.
2. **Arquivos**
   - **Pasta:** caminho completo, ex.: `D:\Documentos\Notas`. Os resultados são gravados aí (ao lado de cada original).
   - **Máscara:** quais arquivos interessam. `*` = qualquer texto, `?` = um caractere; várias separadas por `;`. Ex.: `nf-*.pdf;recibo??.pdf`.
   - **Incluir subpastas:** procura também dentro das subpastas.
   - Clique em **Procurar** e confira a lista (tamanho e caminho de cada arquivo).
3. **Opções** — nível de compressão, ou senha (proteger/desproteger).
4. **Revisar e confirmar** — um resumo descreve exatamente o que será feito. Nada acontece até você clicar em **Confirmar e executar**.
5. **Relatório** — resultado de cada arquivo, onde foi gravado e, na compressão, quanto diminuiu.

## O que cada operação produz

| Operação    | Resultado                                                           |
| ----------- | ------------------------------------------------------------------- |
| Juntar      | `juntado-AAAAMMDD-HHMMSS.pdf` na pasta informada, na ordem da lista |
| Comprimir   | `nome-comprimido.pdf` (descartado se não ficar menor)               |
| A4          | `nome-a4.pdf` — cada página em A4, ajustada proporcionalmente       |
| Proteger    | `nome-protegido.pdf` — exige senha para abrir (AES-256)             |
| Desproteger | `nome-desprotegido.pdf` — sem senha                                 |

Níveis de compressão: **Leve** (300 dpi, para impressão), **Médio** (150 dpi, padrão), **Forte** (72 dpi, menor tamanho).

## DOCX → PDF

Se a pasta tiver `carta.docx` e **não** tiver `carta.pdf`, e `carta.pdf` passar na máscara, o documento é convertido para `carta.pdf` (ao lado do DOCX) e entra na operação. A conversão usa o **Microsoft Word** (sem abrir janela) ou, sem Word, o **LibreOffice**.

## Garantias

- **Os originais nunca são alterados nem apagados.**
- Se o nome de saída já existir, grava `nome (2).pdf`, `nome (3).pdf`…
- Arquivos gerados pela rotina (`-comprimido`, `-a4`, `-protegido`, `-desprotegido`, `juntado-…`) são ignorados nas buscas, para não serem reprocessados.
- Senhas não ficam salvas e não aparecem na linha de comando das ferramentas.

## Ferramentas necessárias

| Ferramenta          | Para quê                                 | Instalação (terminal como administrador) |
| ------------------- | ---------------------------------------- | ---------------------------------------- |
| qpdf                | proteger, desproteger, compressão básica | `winget install --id QPDF.QPDF -e`       |
| Ghostscript         | compressão de imagens (a mais eficiente) | `choco install ghostscript -y`           |
| Word ou LibreOffice | converter DOCX                           | —                                        |

Juntar e A4 não precisam de nada instalado. A rotina detecta o que falta, mostra o comando e bloqueia só as operações afetadas. Para apontar um executável específico, use as variáveis de ambiente `QPDF_PATH`, `GHOSTSCRIPT_PATH` ou `SOFFICE_PATH`.

## Dicas

- PDFs protegidos por senha precisam ser **desprotegidos antes** de juntar, comprimir ou converter para A4.
- Juntar e A4 recriam as páginas: links internos e formulários podem não ser preservados.
- A pasta, a máscara e a operação ficam lembradas neste navegador.

## Para desenvolvedores

| Arquivo             | Responsabilidade                                                     |
| ------------------- | -------------------------------------------------------------------- |
| `index.ts`          | manifesto da rotina                                                  |
| `PdfTools.tsx`      | UI em etapas: operação → arquivos → opções → confirmação → relatório |
| `mask.ts`           | máscara de nomes `*`/`?`/`;` (puro)                                  |
| `naming.ts`         | nomes de saída, detecção de arquivos gerados, tamanhos (puro)        |
| `operations.ts`     | tipos compartilhados, validação e resumo de confirmação (puro)       |
| `storage.ts`        | preferências no navegador (sem senhas)                               |
| `server/actions.ts` | Server Actions (`"use server"`), só aceitam `localhost`              |
| `server/local.ts`   | verificação do host                                                  |
| `server/scan.ts`    | busca de arquivos (máscara, subpastas, DOCX sem PDF)                 |
| `server/pdf.ts`     | juntar e A4 com pdf-lib                                              |
| `server/tools.ts`   | localiza e executa qpdf, Ghostscript, Word (COM) e LibreOffice       |
| `server/run.ts`     | executa a operação e monta o relatório                               |

Testes de qpdf/Ghostscript rodam só se as ferramentas estiverem instaladas. O teste de conversão DOCX é opcional: `PDF_TOOLS_TEST_DOCX=C:\caminho\arquivo.docx npm run test`.
