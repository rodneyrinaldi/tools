# 🎬 Teleprompter

Leia seu roteiro olhando para a câmera. O texto rola de forma contínua: a linha que você está lendo fica numa guia perto do topo da tela, com o que já foi lido logo acima e o que vem depois logo abaixo. Quem dita o ritmo é você: o texto **segue a sua voz** ou anda numa **velocidade** que você ajusta ao vivo.

- **Acesso:** `/#teleprompter`
- **Status:** beta
- **Spec:** [SPEC.md](./SPEC.md)

## Como usar

1. Cole ou escreva o roteiro. Separe parágrafos com uma **linha em branco**.
2. Escolha a **condução**:
   - **🎙 Voz** (recomendado): o texto acompanha sua fala. Na primeira vez, o navegador pede permissão para usar o microfone.
   - **⏩ Velocidade**: rolagem constante. Escolha Lento, Normal ou Rápido e se as **pausas marcadas** seguram o texto ou são só visuais.
3. Defina a **contagem regressiva** e clique em **Iniciar** (dentro da página) ou **Iniciar em modo foco** (tela cheia, só o texto). `Ctrl+Enter` também inicia.
4. Leia a linha na **guia** (faixa com a seta ▶). As linhas já lidas continuam visíveis acima, para você se reencontrar se se perder.
5. Ao final, escolha **Reiniciar** ou **Voltar ao editor**.

O roteiro e as preferências ficam salvos neste navegador; **Limpar** pede um segundo clique para confirmar.

## Seguir a voz

O navegador transforma sua fala em texto e a rotina procura essas palavras no roteiro, perto de onde você está:

- falou mais rápido, o texto acompanha; parou, respirou ou improvisou, o texto espera;
- pulou um trecho, o texto avança até onde você está; repetiu uma frase, o texto volta;
- erros do reconhecimento (acentos, plurais, palavras cortadas) são tolerados.

**Requisitos e privacidade:** funciona no **Chrome** e no **Edge**, com internet. No Chrome, o áudio é processado pelos servidores do Google. Se o microfone estiver bloqueado ou o reconhecimento falhar, um aviso oferece **Usar velocidade**, e `V` alterna entre os modos a qualquer momento.

**Dica:** números falados ("vinte por cento") não casam com algarismos ("20%"). O texto se reencontra nas palavras seguintes; se preferir, escreva os números por extenso.

## Marcações

| Escreva                | Aparece como                                 | Efeito                                                   |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `[pausa]`              | etiqueta âmbar `⏸ 2s`                        | lembrete de pausa (no modo velocidade, pode segurar 2 s) |
| `[pausa 5]`            | etiqueta âmbar `⏸ 5s`                        | idem, com o tempo dado                                   |
| `[respira]`            | etiqueta ciano `respira`                     | lembrete de respiro (pode segurar 1 s)                   |
| `*texto em destaque*`  | negrito na cor de destaque                   | —                                                        |
| `[sorria]`, `[gesto]`… | etiqueta rosa em itálico (indicação de cena) | —                                                        |
| `// anotação`          | nada (linha inteira é ignorada)              | —                                                        |

Os botões **Inserir** colocam as marcações na posição do cursor (ênfase e indicação envolvem o texto selecionado).

### Marcação automática

Clique em **✨ Auto** para o roteiro ganhar as marcações onde fazem mais sentido. Com um trecho selecionado, ele age só na seleção.

- `[pausa 2]` no fim de cada parágrafo; `[pausa 1]` depois de perguntas e reticências.
- `[respira]` depois de frases longas e em vírgulas de frases muito longas.
- `[sorria]` em saudações e agradecimentos ("Olá", "Bom dia", "Obrigado", "Até a próxima"…).
- `[olhe para a câmera]` em chamadas para ação ("Inscreva-se", "Comente", "Clique"…).
- Ênfase em percentuais (`*35%*`).

Marcações que você já colocou são respeitadas e nada é duplicado.

O botão funciona como **liga/desliga**: se o roteiro já tem marcações, ele vira **✨ Remover marcações** e retira **todas** (inclusive as que você colocou à mão), deixando o texto limpo. Em qualquer caso, **Desfazer** volta o texto anterior.

## Atalhos durante a apresentação

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

`PageUp`/`PageDown` permitem usar um passador de slides como controle remoto.

## Dicas

- Posicione a janela/monitor de forma que a **guia** (≈ 30% do topo) fique logo abaixo da câmera.
- Se se perder, olhe para as linhas esmaecidas acima da guia, ou use `↑`/`↓` ou a roda do mouse. No modo voz, basta continuar lendo de onde você está.
- No **modo foco** os controles somem após 2,5 s sem mexer o mouse; mova o mouse para trazê-los de volta.
- A tela não apaga durante a apresentação (em navegadores com suporte a Wake Lock).

## Para desenvolvedores

| Arquivo                   | Responsabilidade                                                 |
| ------------------------- | ---------------------------------------------------------------- |
| `index.ts`                | manifesto da rotina                                              |
| `Teleprompter.tsx`        | alterna editor ↔ apresentação; preferências; tela cheia          |
| `Editor.tsx`              | tela de edição, condução e inserção de marcações                 |
| `Session.tsx`             | laço de rolagem (requestAnimationFrame), voz/velocidade, atalhos |
| `Presenter.tsx`           | visual: guia, contexto, controles (encaixada e foco via portal)  |
| `scroll.ts`               | geometria da rolagem contínua (puro)                             |
| `voice.ts`                | alinhamento das palavras faladas com o roteiro (puro)            |
| `useSpeechRecognition.ts` | microfone via Web Speech API, com reinício automático            |
| `autoMark.ts`             | marcação automática por heurísticas (puro)                       |
| `script.ts`               | parser de marcações, quebra de linhas e durações (puro)          |
| `playback.ts`             | fases da reprodução (puro)                                       |
| `measure.ts`              | medição do texto com a fonte real (canvas)                       |
| `storage.ts`              | persistência local das preferências                              |

A posição do texto muda a cada quadro e é aplicada direto no DOM (`transform`), sem re-renderizar; o React só re-renderiza quando a linha sob a guia muda. A posição também é guardada em "tokens" para continuar correta quando o texto é re-quebrado (redimensionar a janela ou trocar de visualização).
