# 🎬 Teleprompter

Leia seu roteiro olhando para a câmera. O texto rola de forma contínua: a linha que você está lendo fica numa guia perto do topo da tela, com o que já foi lido logo acima e o que vem depois logo abaixo. Quem dita o ritmo é você: o texto **segue a sua voz** ou anda numa **velocidade** que você ajusta ao vivo. Com a **câmera ligada**, você se vê ao fundo, com o texto por cima, e grava o vídeo direto da tela — inclusive no celular.

- **Acesso:** `/#teleprompter`
- **Status:** beta
- **Spec:** [SPEC.md](./SPEC.md)

## Como usar

1. Cole ou escreva o roteiro. Separe parágrafos com uma **linha em branco**.
2. Escolha a **condução**:
   - **🎙 Voz** (recomendado): o texto acompanha sua fala. Na primeira vez, o navegador pede permissão para usar o microfone.
     - **Reconhecimento de voz → 📱 No aparelho** (padrão): reconhece a fala no próprio celular/computador. O áudio não sai do aparelho e, com a câmera, o vídeo é gravado **com som**. Na primeira vez baixa cerca de 32 MB (fica em cache; depois funciona até sem internet).
     - **🌐 Do navegador**: usa o reconhecimento do Chrome/Edge (áudio processado pelo Google). Ele precisa do microfone só para si, então com a câmera o vídeo é gravado **sem som**. Use se o aparelho for lento demais para o reconhecimento local.
   - **⏩ Velocidade**: rolagem constante. Escolha Lento, Normal ou Rápido e se as **pausas marcadas** seguram o texto ou são só visuais.
3. Defina a **contagem regressiva** e clique em **Iniciar** (dentro da página) ou **Iniciar em modo foco** (tela cheia, só o texto). `Ctrl+Enter` também inicia.
4. Leia a linha na **guia** (faixa com a seta ▶). As linhas já lidas continuam visíveis acima, para você se reencontrar se se perder.
5. Ao final, escolha **Reiniciar** ou **Voltar ao editor**.

O roteiro e as preferências ficam salvos neste navegador; **Limpar** pede um segundo clique para confirmar.

## Gravar com a câmera

1. No editor, toque em **🎥 Com câmera** (ou ligue **Câmera** para escolher antes quanto **escurecer a imagem** e a câmera **frontal** ou **traseira**, e toque em **🎥 Abrir câmera**).
2. Permita o acesso à câmera e ao microfone quando o navegador perguntar. Você se vê ao fundo, escurecido, com o texto por cima em cor viva.
3. Use os botões grandes na parte de baixo:

| Botão                   | O que faz                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| **●** (círculo central) | grava: contagem regressiva e, depois, grava e rola o texto           |
| **⏸ / ▶** (central)     | durante a gravação, pausa e continua **a gravação e o texto juntos** |
| **⏹ Parar**             | encerra a gravação e mostra a prévia                                 |
| **▶ Ensaiar**           | rola o texto sem gravar                                              |
| **Sair**                | volta ao editor (se estiver gravando, a gravação é guardada)         |

No topo aparece **● REC 01:23** (ou **PAUSADO**). Na linha de cima ficam ↑ ↓, voz/velocidade, ± velocidade e **🔄** para trocar de câmera.

4. Ao parar, assista à prévia e toque em **Baixar** ou **Compartilhar** (no celular, o Compartilhar permite salvar na galeria ou enviar por um app).
5. As gravações da sessão também aparecem no editor, em **Gravações**. Elas ficam só neste navegador até você fechar a página: o navegador avisa se ainda houver alguma não salva.

O vídeo gravado contém **só a câmera e o microfone**, sem o texto. A câmera frontal aparece espelhada na tela, como um espelho, mas o vídeo sai normal. Formato: MP4 quando o navegador suporta, senão WebM.

### No celular

A câmera só funciona em **HTTPS** (ou em `localhost`). Para usar no celular na mesma rede Wi-Fi:

1. No computador, rode `npm run dev:celular`.
2. No celular, abra `https://<IP do computador>:3000/#teleprompter` (o IP aparece no terminal; no Windows também em `ipconfig`).
3. O certificado é autoassinado: o navegador mostra um aviso; toque em **Avançado → Continuar**.

Alternativa sem aviso de certificado: publicar o app num serviço com HTTPS (ex.: Vercel); o teleprompter roda inteiro no navegador.

**Voz com a câmera ligada:** com o reconhecimento **no aparelho**, a gravação e a voz usam o mesmo microfone — o vídeo sai com som e o texto segue a fala. Na primeira gravação, espere "Preparando a voz…" virar "Ouvindo" (download do modelo). Se o modelo não carregar, a rotina passa sozinha para o reconhecimento do navegador. Se aparecer "Mic ocupado" ou "Não estou ouvindo sua voz", toque em **Usar velocidade**: o texto passa a rolar sozinho e a gravação continua (ajuste o ritmo com − e +).

## Formatação do texto

Use etiquetas entre chaves para colorir e destacar trechos:

```
{amarelo}Atenção{/} para este ponto.
Isto é {grande negrito}muito importante{/}.
{azul}Texto azul com {sublinhado}parte sublinhada{/} dentro.{/}
```

| Grupo   | Palavras                                                                  |
| ------- | ------------------------------------------------------------------------- |
| Cores   | amarelo, vermelho, verde, azul, ciano, rosa, laranja, roxo, branco, cinza |
| Tamanho | grande, pequeno                                                           |
| Fonte   | serifa, mono                                                              |
| Estilo  | negrito, itálico, sublinhado, destaque                                    |

- Combine palavras numa etiqueta (`{verde grande}`), aninhe etiquetas e feche cada uma com `{/}`.
- No editor, selecione o trecho e use **Formatar** (N, I, S, A+, A−, Destaque, Serifa) ou as **bolinhas de cor**. **Prévia** mostra o resultado.
- **Cor do texto** define a cor base de todo o texto (branco, amarelo, ciano ou verde); as `{cores}` têm prioridade.
- Etiquetas com palavras desconhecidas aparecem como texto normal.

## Seguir a voz

O reconhecedor transforma sua fala em texto e a rotina procura essas palavras no roteiro, perto de onde você está. No aparelho, o reconhecedor conhece só as palavras do roteiro, o que reduz os erros:

- falou mais rápido, o texto acompanha; parou, respirou ou improvisou, o texto espera;
- pulou um trecho, o texto avança até onde você está; repetiu uma frase, o texto volta;
- o texto **não vai e volta** com as correções que o reconhecedor faz enquanto você fala: ele só volta quando você claramente repete um trecho, e saltos grandes para frente precisam se confirmar;
- erros do reconhecimento (acentos, plurais, palavras cortadas) são tolerados.

**Requisitos e privacidade:** o reconhecimento **no aparelho** (Vosk, em WebAssembly) funciona nos navegadores modernos, inclusive sem internet depois do primeiro download, e o áudio não sai do aparelho. O **do navegador** funciona no **Chrome** e no **Edge**, com internet; no Chrome, o áudio é processado pelos servidores do Google. Se o microfone estiver bloqueado ou o reconhecimento falhar, um aviso oferece **Usar velocidade**, e `V` alterna entre os modos a qualquer momento.

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
| `G`              | gravar / parar gravação (modo câmera)           |
| `R`              | reiniciar com contagem                          |
| `[` / `]`        | diminuir / aumentar a letra                     |
| `F`              | alternar modo foco                              |
| `Esc`            | sair (no modo foco, sai primeiro da tela cheia) |

`PageUp`/`PageDown` permitem usar um passador de slides como controle remoto.

## Dicas

- **Tamanho da letra:** escolha P, M, G ou GG no editor, ou use **A− / A+** durante a leitura (também `[` e `]`). O tamanho fica salvo.

- Posicione a janela/monitor de forma que a **guia** (≈ 30% do topo) fique logo abaixo da câmera.
- Se se perder, olhe para as linhas esmaecidas acima da guia, ou use `↑`/`↓` ou a roda do mouse. No modo voz, basta continuar lendo de onde você está.
- No **modo foco** os controles somem após 2,5 s sem mexer o mouse; mova o mouse para trazê-los de volta.
- A tela não apaga durante a apresentação (em navegadores com suporte a Wake Lock).

## Para desenvolvedores

| Arquivo                         | Responsabilidade                                                 |
| ------------------------------- | ---------------------------------------------------------------- |
| `index.ts`                      | manifesto da rotina                                              |
| `Teleprompter.tsx`              | alterna editor ↔ apresentação; preferências; tela cheia          |
| `Editor.tsx`                    | tela de edição, condução e inserção de marcações                 |
| `Session.tsx`                   | laço de rolagem (requestAnimationFrame), voz/velocidade, atalhos |
| `Presenter.tsx`                 | visual: guia, contexto, controles (encaixada, foco e câmera)     |
| `TokenView.tsx`                 | palavras formatadas e marcações (apresentação e prévia)          |
| `format.ts`                     | etiquetas de formatação `{…}` (puro)                             |
| `CameraBar.tsx`                 | controles de toque do modo câmera e indicador REC                |
| `Takes.tsx`                     | gravações: prévia, baixar, compartilhar, lista                   |
| `camera.ts`                     | tipos e funções puras de câmera e gravação                       |
| `useCamera.ts`                  | câmera + microfone (getUserMedia)                                |
| `useRecorder.ts`                | gravação (MediaRecorder), pausa e cronômetro                     |
| `scroll.ts`                     | geometria da rolagem contínua (puro)                             |
| `voice.ts`                      | alinhamento das palavras faladas com o roteiro (puro)            |
| `useSpeechRecognition.ts`       | microfone via Web Speech API, com reinício automático            |
| `useDeviceSpeechRecognition.ts` | reconhecimento no aparelho (Vosk), ouvindo a faixa da câmera     |
| `audioFeed.ts`                  | áudio do microfone em blocos para o reconhecedor (AudioWorklet)  |
| `voiceEngine.ts`                | escolha do reconhecedor (aparelho ou navegador) e suporte        |
| `autoMark.ts`                   | marcação automática por heurísticas (puro)                       |
| `script.ts`                     | parser de marcações, quebra de linhas e durações (puro)          |
| `playback.ts`                   | fases da reprodução (puro)                                       |
| `measure.ts`                    | medição do texto com a fonte real (canvas)                       |
| `storage.ts`                    | persistência local das preferências                              |

A posição do texto muda a cada quadro e é aplicada direto no DOM (`transform`), sem re-renderizar; o React só re-renderiza quando a linha sob a guia muda. A posição também é guardada em "tokens" para continuar correta quando o texto é re-quebrado (redimensionar a janela ou trocar de visualização).

Para reproduzir esta funcionalidade em outro projeto (seguindo as regras e o design system de lá), use o prompt portável em [`docs/prompts/teleprompter-portavel.md`](../../../docs/prompts/teleprompter-portavel.md).
