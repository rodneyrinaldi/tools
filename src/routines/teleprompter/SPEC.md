# Rotina: Teleprompter

| Campo  | Valor          |
| ------ | -------------- |
| id     | `teleprompter` |
| status | beta           |
| autor  | Rodney Rinaldi |

## Objetivo

Exibir um roteiro para leitura diante da câmera em rolagem contínua, com a linha em leitura numa guia perto do topo (logo abaixo da câmera), contexto visível antes e depois, e o ritmo ditado por quem lê — pela voz ou por uma velocidade ajustável ao vivo.

### Histórico

A versão anterior mostrava uma linha por vez, com tempo fixo por linha e o texto lido sumindo. Na prática, a leitura se perdia: o ritmo da fala varia, não havia contexto para planejar a frase e não era possível se reposicionar. Foi substituída pelo modelo de rolagem contínua abaixo, que é como teleprompters profissionais funcionam.

## Comportamento

### Editor

1. Campo de texto grande para o roteiro. Parágrafos são separados por linha em branco.
2. Botões que inserem marcações na posição do cursor: pausa, respira, ênfase (envolve a seleção) e indicação de cena.
3. **Condução:** **🎙 Voz** (padrão; desabilitada se o navegador não suporta reconhecimento de fala) ou **⏩ Velocidade**. Um texto explica cada modo e avisa que, no Chrome, o áudio é processado pelo Google.
4. No modo velocidade: **Lento** (110 ppm), **Normal** (140 ppm), **Rápido** (175 ppm) e **Pausas marcadas**: "Só visuais" (padrão) ou "Seguram o texto".
5. Contagem regressiva em segundos (0–60, padrão 3).
6. Exibe a duração estimada do roteiro (a 140 ppm no modo voz).
7. **Iniciar** (visualização encaixada) e **Iniciar em modo foco** (tela cheia). Desabilitados com roteiro vazio. `Ctrl+Enter` inicia.
8. **Limpar** pede confirmação (segundo clique em até 3 s) e apaga o roteiro.
9. Roteiro e preferências (condução, velocidade, pausas, contagem) ficam salvos no navegador.

### Marcações

| Sintaxe                  | Exibição                                     | Efeito (modo velocidade com "Seguram o texto") |
| ------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `[pausa]` / `[pausa 5]`  | etiqueta âmbar "⏸ 2s" / "⏸ 5s"               | a linha leva N s a mais para passar (padrão 2) |
| `[respira]`              | etiqueta ciano "respira"                     | a linha leva 1 s a mais                        |
| `*texto*`                | ênfase: negrito na cor de destaque           | —                                              |
| `[qualquer outra coisa]` | etiqueta rosa em itálico (indicação de cena) | —                                              |
| linha iniciada por `//`  | nota de bastidor, não exibida                | —                                              |

### Marcação automática (✨ Auto)

Botão alternador na linha de inserção. Age na seleção, se houver; senão, no roteiro inteiro.

- **Sem marcações** → o botão mostra **✨ Auto** e insere marcações conforme as regras abaixo.
- **Com marcações** → o botão mostra **✨ Remover marcações** (pressionado) e remove **todas** as marcações, inclusive as manuais: colchetes somem e ênfases viram texto normal. Notas `//` e o espaçamento do resto do texto ficam intactos.

Regras de inserção:

| Onde                                                                  | Insere                 |
| --------------------------------------------------------------------- | ---------------------- |
| fim de cada parágrafo (exceto o último)                               | `[pausa 2]`            |
| depois de pergunta (`?`) ou reticências                               | `[pausa 1]`            |
| fim de frase após 12+ palavras sem respiro                            | `[respira]`            |
| vírgula/ponto e vírgula/dois-pontos após 20+ palavras sem respiro     | `[respira]`            |
| início de frase com chamada para ação (inscreva-se, comente, clique…) | `[olhe para a câmera]` |
| início de frase com saudação/agradecimento (olá, bom dia, obrigado…)  | `[sorria]`             |
| percentuais (`35%`) fora de ênfase                                    | `*35%*`                |

- Não duplica: frases que já têm indicação, ou fins de frase já seguidos de pausa/respiro, são mantidos. Rodar de novo não muda nada.
- Mostra quantas marcações foram inseridas ou removidas ("+N marcações", "−N marcações" ou "Nada a sugerir") e oferece **Desfazer** enquanto o texto não for editado.
- Ignora linhas de nota (`//`).

### Apresentação

1. Contagem regressiva grande; ao chegar a 0, começa a leitura.
2. O roteiro inteiro fica numa coluna estreita e centralizada (≈ 20em), quebrado em linhas de largura fixa.
3. **Linha-guia** fixa a 30% da altura (26% no modo foco), marcada por uma faixa sutil e uma seta ▶ na lateral. A linha sob a guia tem brilho total.
4. **Contexto:** as linhas já lidas continuam visíveis acima da guia (esmaecidas, desaparecendo aos poucos no topo); as próximas, inclusive de outros parágrafos, ficam legíveis abaixo.
5. **Rolagem contínua e suave**, sem saltos.
   - **Modo voz:** o microfone ouve a leitura; as palavras reconhecidas são alinhadas ao roteiro (tolerando acentos, erros do reconhecedor e palavras puladas) e o texto desliza até a palavra dita. Pausas na fala param o texto; repetir um trecho anterior faz o texto voltar.
   - **Modo velocidade:** cada linha leva `palavras ÷ ppm` para passar pela guia (+ pausas, se "Seguram o texto").
6. **Reposicionar a qualquer momento** com `↑`/`↓` (uma linha), roda do mouse/trackpad (fino) ou passador de slides. No modo voz, a escuta recomeça a partir do novo ponto, descartando o que já foi ouvido.
7. Indicador do microfone (ligando, ouvindo, bloqueado, falha). Microfone bloqueado ou falha mostram um aviso com **Usar velocidade**.
8. Alternar entre voz e velocidade durante a apresentação (botão ou `V`), mantendo a posição.
9. Ao final, tela "Fim" com Reiniciar e Voltar ao editor.
10. **Visualização encaixada:** dentro da moldura da rotina, com o design do projeto.
11. **Modo foco:** ocupa a tela toda (tela cheia do navegador), fundo preto, nada além do texto; os controles somem após 2,5 s sem mexer o mouse (exceto com aviso do microfone).
12. A tela não apaga durante a apresentação (Wake Lock, quando suportado).

### Atalhos (durante a apresentação)

| Tecla            | Ação                                            |
| ---------------- | ----------------------------------------------- |
| `Espaço`         | pausar / continuar (na contagem: começar já)    |
| `↓` / `PageDown` | avançar uma linha                               |
| `↑` / `PageUp`   | voltar uma linha                                |
| roda do mouse    | reposicionar fino                               |
| `+` / `−`        | velocidade ±10 ppm (modo velocidade)            |
| `V`              | alternar voz ↔ velocidade                       |
| `R`              | reiniciar com contagem                          |
| `F`              | alternar modo foco                              |
| `Esc`            | sair (no modo foco, sai primeiro da tela cheia) |

`PageUp/PageDown` permitem usar passadores de slides.

## Critérios de aceite

- [x] Parser reconhece parágrafos, pausas (com e sem segundos), respira, ênfase, indicações e notas.
- [x] Quebra de linhas respeita a largura e nunca perde palavras.
- [x] Duração da linha proporcional às palavras e à velocidade; pausas somadas só com "Seguram o texto".
- [x] Iniciar desabilitado com roteiro vazio.
- [x] Contagem regressiva antes do início; Espaço pula a contagem.
- [x] Rolagem contínua (sem saltos), com linhas já lidas visíveis acima da guia e próximas abaixo.
- [x] Modo voz: o texto avança conforme as palavras ditas, tolera erros e palavras puladas, ignora fala fora do roteiro e volta quando um trecho é repetido.
- [x] Modo voz: microfone bloqueado mostra aviso e permite trocar para velocidade.
- [x] Pausar e continuar de onde parou; reposicionar por setas, roda do mouse e passador.
- [x] Reiniciar, sair, alternar voz/velocidade e ajustar velocidade por botão e teclado.
- [x] Modo foco em tela cheia, sem nenhum elemento além do texto e controles autoocultáveis.
- [x] Mudar de visualização (ou redimensionar) mantém a posição de leitura.
- [x] ✨ Auto insere marcações conforme as regras, na seleção ou no roteiro todo, sem duplicar (idempotente).
- [x] Com marcações no roteiro, o mesmo botão remove todas (alternador), preservando notas e espaçamento.
- [x] Desfazer restaura o texto anterior ao Auto ou à remoção.
- [x] Limpar exige confirmação.
- [x] Roteiro e preferências persistem ao recarregar.
- [x] Marcações exibidas em cores próprias, distintas do texto lido: pausa âmbar, respira ciano, indicação rosa.
- [x] Controles com rótulos acessíveis; contagem anunciada por `aria-live`.
- [x] Usa componentes e tokens de `@/design-system`.

## Suposições

- Largura de linha medida com a fonte real (canvas); sem canvas, usa contagem de caracteres.
- Reconhecimento de fala pela Web Speech API (`pt-BR`), disponível no Chrome e no Edge; no Chrome, o áudio é processado em servidores do Google e exige internet.
- Números falados ("vinte por cento") não casam com algarismos ("20%"); o alinhamento se reancora nas palavras seguintes.

## Fora de escopo

- Reconhecimento de fala local/offline.
- Espelhamento horizontal (vidro de teleprompter físico).
- Ajuste do tamanho da fonte e da largura da coluna.
- Controle remoto pelo celular.

## Arquivos

- `index.ts` — manifesto
- `Teleprompter.tsx` — alterna editor ↔ apresentação, preferências e tela cheia
- `Session.tsx` — apresentação em andamento: laço de rolagem, voz/velocidade, reposicionamento, atalhos e wake lock
- `Editor.tsx` / `Editor.module.css` — tela de edição
- `Presenter.tsx` / `Presenter.module.css` — apresentação (guia, contexto, controles; encaixada e foco)
- `autoMark.ts` — marcação automática (pura)
- `script.ts` — parser, quebra de linhas e durações (puro)
- `scroll.ts` — geometria da rolagem contínua (puro)
- `voice.ts` — alinhamento da fala com o roteiro (puro)
- `useSpeechRecognition.ts` — microfone / Web Speech API
- `playback.ts` — fases da reprodução (pura)
- `measure.ts` — medição de texto (canvas / fallback)
- `storage.ts` — persistência local
- `*.test.ts(x)` — testes
