# Tarefa: implementar um Teleprompter neste projeto

Implemente neste projeto uma funcionalidade de **teleprompter**: a pessoa cola um roteiro e o lê olhando para a câmera. O texto rola na tela no ritmo da leitura.

## Regras de implementação (obrigatórias)

- **Siga as convenções deste projeto**: arquitetura, estrutura de pastas, roteamento, gerenciamento de estado, padrão de testes, lint e formatação, idioma dos textos e documentação exigida (README, spec, changelog etc.). Leia antes as instruções do projeto (CLAUDE.md, AGENTS.md, CONTRIBUTING, README ou equivalentes).
- **Use o design system deste projeto**: componentes, tokens de cor, espaçamento, tipografia e movimento. Não crie estilos paralelos. Se faltar um componente reutilizável (área de texto, grupo de opções exclusivas), crie-o no design system, seguindo o padrão dele.
- As cores citadas abaixo são **papéis semânticos**. Mapeie cada uma para o token mais próximo do design system.
- Nada deste documento obriga a usar uma biblioteca ou framework específico. Ele descreve **comportamento**.
- Antes de codar, escreva a spec/critérios de aceite no formato do projeto. Ao final, rode as validações do projeto e informe o resultado real.

## Visão geral

São duas telas:

1. **Editor**: escrever o roteiro, marcar pausas e indicações, escolher como a rolagem é conduzida.
2. **Apresentação**: leitura em rolagem contínua, com duas visualizações. Uma fica **encaixada** no layout normal do app. A outra é o **modo foco**: tela cheia, fundo preto, só o texto.

---

## 1. Roteiro e marcações

- Parágrafos são separados por **linha em branco**. Quebras simples dentro do parágrafo viram espaço.
- Linhas que começam com `//` são **notas**: não aparecem na apresentação e nunca são alteradas por automações.
- Marcações (parser por tokens: `\[[^\]\n]*\]` | `\*[^*\n]+\*` | palavra):

| Sintaxe                                  | Significado                         | Exibição na apresentação                                                       |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `[pausa]` / `[pausa 5]` / `[pausa 1,5s]` | pausa (padrão 2 s)                  | etiqueta pequena "⏸ 2s", cor de **aviso** (âmbar)                              |
| `[respira]`                              | respiro (1 s)                       | etiqueta "respira", cor **secundária** (ciano)                                 |
| `*texto*` (pode ter várias palavras)     | ênfase (é lido)                     | negrito na cor de **destaque** principal                                       |
| `[qualquer outro texto]`                 | indicação de cena (ex.: `[sorria]`) | etiqueta itálica com borda tracejada, em uma **terceira cor exclusiva** (rosa) |

- **As marcações nunca usam a cor do texto lido**, para não serem lidas em voz alta. Cada tipo tem cor própria, fundo translúcido e borda. As etiquetas usam fonte menor (≈ 0,6em), elevadas na linha.
- Pontuação colada a uma marcação (ex.: `*palavra*,`) não ganha espaço extra. Guarde em cada token se ele está "colado" ao anterior.

## 2. Editor

- Área de texto grande com label e dica ("separe parágrafos com linha em branco; `//` são notas").
- **Botões de inserção** na posição do cursor:
  - Pausa insere `[pausa 2]`.
  - Respira insere `[respira]`.
  - Ênfase envolve a seleção com `*…*`; sem seleção, usa o placeholder "palavra".
  - Indicação envolve a seleção com `[…]`; sem seleção, usa "sorria".
  - Adicione espaço antes se necessário e mantenha o texto inserido selecionado.
- **Botão "✨ Auto" (alternador)**. Age na seleção, se houver; senão, no roteiro todo.
  - Roteiro **sem** marcações: insere marcações automaticamente (regras na seção 3). O rótulo é "✨ Auto".
  - Roteiro **com** marcações: o rótulo vira "✨ Remover marcações" (estado pressionado, `aria-pressed`) e remove **todas**. Colchetes somem junto com o espaço que os precede. Ênfases viram texto normal. Se a linha começava com marcação, apare o espaço inicial. Notas `//` e o espaçamento do resto do texto ficam intactos.
  - Mostra "+N marcações", "−N marcações" ou "Nada a sugerir", em região `role="status"`.
  - Oferece **Desfazer** enquanto o texto não for editado.
- **Condução**: grupo de opções exclusivas, "🎙 Voz" (padrão) ou "⏩ Velocidade". Voz fica desabilitada se o navegador não suportar reconhecimento de fala. Um texto curto explica o modo escolhido e avisa que, no Chrome, o áudio é processado pelo Google.
- Só no modo velocidade:
  - **Velocidade**: Lento 110, Normal 140 ou Rápido 175 palavras por minuto (ppm).
  - **Pausas marcadas**: "Só visuais" (padrão) ou "Seguram o texto".
- **Contagem regressiva** em segundos: 0 a 60, padrão 3.
- **Duração estimada**: palavras ÷ ppm + soma das pausas. No modo voz, use 140 ppm e mostre "no seu ritmo".
- Botões **Iniciar** e **Iniciar em modo foco**, desabilitados com roteiro vazio. `Ctrl/Cmd+Enter` inicia.
- **Limpar** exige confirmação: o primeiro clique troca o rótulo para "Confirmar limpeza" por 3 s.
- Persista no armazenamento local o roteiro, a condução, a velocidade, as pausas e a contagem. Envolva leitura e escrita em try/catch e valide os valores lidos.

## 3. Marcação automática (heurísticas para pt-BR, sem rede)

Processe por parágrafo, ignorando notas. Agrupe os tokens em frases. Uma frase termina em palavra que acaba com `. ! ? …`, opcionalmente seguida de aspas ou parênteses de fechamento; ignore abreviações como "Sr.", "Dr.", "Prof." e "etc.". Pausas e respiros logo após o fim da frase pertencem a essa frase. Uma indicação após o fim **abre a frase seguinte**.

| Onde                                                                          | Insere                 |
| ----------------------------------------------------------------------------- | ---------------------- |
| fim de cada parágrafo, exceto o último                                        | `[pausa 2]`            |
| depois de `?`, `…` ou `...`                                                   | `[pausa 1]`            |
| fim de frase (que não é a última do parágrafo) após ≥ 12 palavras sem respiro | `[respira]`            |
| palavra terminada em `, ; :` após ≥ 20 palavras sem respiro                   | `[respira]`            |
| início de frase com chamada para ação                                         | `[olhe para a câmera]` |
| início de frase com saudação ou agradecimento (só se não houver chamada)      | `[sorria]`             |
| percentual (`35%`) fora de trecho já enfatizado                               | `*35%*`                |

- **Chamadas para ação**: inscreva-se, se inscrev…, clique, comente, compartilhe, "curta o/este/esse vídeo", "me/nos siga", "siga o/a/nosso/meu canal/perfil/página", acesse, "ative o sininho", "deixe seu/o like", "link na descri…". **Não** use "curta" nem "siga" sozinhos: dão falso positivo, como "Curta." no sentido de "breve".
- **Saudações**: olá, oi, bom dia, boa tarde, boa noite, bem-vindo(s/a/as), obrigado(s/a/as), valeu, parabéns, tchau, "até a próxima/logo/mais".
- Use limites de palavra que entendam acentos, como `(?<!\p{L})…(?!\p{L})` com flag `u`. Assim "Oito" não casa com "oi".
- O contador de "palavras sem respiro" zera em qualquer pausa ou respiro, existente ou inserido.
- **Respeite o que já existe**:
  - não insira indicação em frase que já tem uma;
  - não insira nada no fim de frase já seguida de pausa ou respiro;
  - não enfatize dentro de `*…*` (conte os `*` de cada token para saber se está dentro).
- **Precisa ser idempotente**: rodar duas vezes deve devolver o mesmo texto e "0 inseridas".
- Aplique as inserções de trás para frente. Na mesma posição, substituições vêm antes das inserções.

## 4. Apresentação: layout

- **Coluna estreita e centralizada**, com cerca de 20em de texto. O texto é quebrado em **linhas próprias** por medição real: largura do texto na fonte computada, via canvas `measureText`, com margem de 3%. Sem canvas, use cerca de 36 caracteres. Cada linha é um elemento com `white-space: nowrap`.
- A medição de uma etiqueta é ≈ largura do rótulo × 0,6 + 0,8em.
- Remeça quando o contêiner redimensionar (ResizeObserver) e quando as webfonts terminarem de carregar (`document.fonts.ready`).
- Altura de linha: 1,5em. Espaço extra entre parágrafos: 1em.
- **Linha-guia fixa** a ~30% da altura (~26% no modo foco), logo abaixo da câmera. Marque-a com uma faixa horizontal sutil, na cor de destaque translúcida, e uma seta ▶ na lateral esquerda.
- **Contexto visível**:
  - linhas já lidas (acima da guia): opacidade ~0,38;
  - linha sob a guia: opacidade 1;
  - próximas linhas, inclusive de outros parágrafos: ~0,72.
  - Aplique uma máscara em gradiente na coluna: o topo desaparece aos poucos até "guia − 4em" e a base se dissolve a partir de ~82%.
- Tamanho da fonte: encaixado ≈ `clamp(1.4rem, 2.6vw, 2.2rem)`; foco ≈ `clamp(2rem, 4.8vw, 4.6rem)`.
- **Modo foco**:
  - Renderize via **portal no body**. Um elemento `position: fixed` dentro de um contêiner com `backdrop-filter`, `transform` ou `filter` fica preso a ele.
  - Peça tela cheia ao navegador **no próprio clique** do botão. Se for negada, o overlay continua cobrindo a janela.
  - Trave a rolagem do body.
  - Os controles somem após 2,5 s sem mover o mouse, junto com o cursor, exceto se houver aviso de microfone.
  - Saindo da tela cheia pelo navegador (Esc/F11), volte para a visualização encaixada.
- Barra de progresso fina e barra de controles; no modo foco, os controles flutuam.
- Peça **Wake Lock** de tela durante a apresentação e readquira ao voltar a aba.
- Contagem regressiva grande, em `aria-live`, sobre o texto. Ao final, overlay "Fim" com **Reiniciar** e **Voltar ao editor**.

## 5. Apresentação: motor de rolagem

- A posição de leitura `p` é um número de linhas **fracionário**: 2,5 quer dizer que metade da linha 2 passou pela guia. `p = nº de linhas` quer dizer que o roteiro terminou.
- O deslocamento vertical é interpolado entre o topo da linha `floor(p)` e o da seguinte, contando o espaço entre parágrafos. Assim não há saltos.
- **Desempenho**:
  - Atualize a posição num laço `requestAnimationFrame` e aplique-a **direto no DOM** com `transform: translate3d(0, -Yem, 0)`, sem re-renderizar a cada quadro.
  - Re-renderize o estado da UI só quando a linha sob a guia mudar.
  - Ao (re)montar o elemento da trilha, aplique a posição atual (ex.: ref de callback).
  - Limite o delta de tempo por quadro a 100 ms.
- **Re-quebra preserva o ponto de leitura**: guarde a posição também em "índice de token" (token inicial da linha + fração × tokens da linha). Quando as linhas forem recalculadas, converta de volta.
- **Modo velocidade**:
  - Cada linha leva `max(700 ms, palavras ÷ ppm × 60000)` para passar pela guia. Linha sem palavras: 700 ms.
  - Com "Seguram o texto", some os segundos das pausas e respiros da linha.
  - Avance `p` pelo tempo decorrido, atravessando linhas, e termine ao chegar ao fim.
  - `+`/`−` ajustam ±10 ppm, entre 60 e 300.
- **Fases**: contagem → rodando → pausado → fim. Espaço alterna; na contagem, começa já. Reposicionar depois do fim deixa em "pausado".

## 6. Modo voz ("seguir a voz")

- Use a **Web Speech API** (`SpeechRecognition`/`webkitSpeechRecognition`), `lang = "pt-BR"`, `continuous = true`, `interimResults = true`.
- Escute só enquanto estiver "rodando".
- Reinicie sozinho no `onend`, após ~250 ms, a menos que tenha sido parado ou ocorrido erro fatal.
- Erros: `not-allowed` ou `service-not-allowed` significam microfone bloqueado (fatal). `no-speech` e `aborted` são ignorados. Os demais viram "falha".
- Status visível: ligando, ouvindo (ponto verde pulsante), bloqueado, falha. Em bloqueado ou falha, mostre um aviso com o botão **"Usar velocidade"**.
- A cada `onresult`, monte o texto ouvido:
  - mantenha um buffer das ~12 últimas palavras de resultados **finais** e junte a parte **provisória** atual;
  - informe se o texto é **final** (não há provisório pendente).
- **Índice de palavras do roteiro**: só tokens de palavra. Para cada uma, guarde forma normalizada, linha, posição na linha e total de palavras da linha. Normalização: minúsculas, sem acentos (NFD), só `[a-z0-9]`.
- **Similaridade** entre palavra ouvida e palavra do roteiro:
  - iguais;
  - ou prefixo uma da outra, com a menor tendo ≥ 5 letras;
  - ou, com ≥ 4 letras, distância de Levenshtein ≤ 1 (≤ 2 se a maior tiver ≥ 7 letras).
- **Alinhamento** (o cursor é o índice da próxima palavra a ser dita):
  - Pegue as últimas 6 palavras ouvidas.
  - Para cada candidato `j` na janela `[cursor − 12, cursor + 30]` cuja palavra seja similar à **última** palavra ouvida, caminhe para trás casando as demais palavras ouvidas, podendo pular até 2 palavras do roteiro em cada passo.
  - Pontuação: palavra com ≥ 4 letras vale 1; mais curta vale 0,4.
  - Pontuação mínima: 1 se o avanço for de 0 a 3 palavras; 1,8 se for maior; 3 se for recuo.
  - Escolha o melhor por `pontuação − 0,05 × |distância| − (0,5 se recuo)`. O novo cursor é `j + 1`.
- **Proteções contra o "vai e volta"** (essenciais). O reconhecedor revisa hipóteses provisórias, por exemplo "…hoje vamos" vira "…hoje", e sem estas proteções o texto avança, volta e avança de novo:
  - **Recuar** só se o texto ouvido for **final**, o recuo for de **≥ 4 palavras** e a pontuação for ≥ 3. Fora isso, ignore o recuo.
  - **Avançar ≤ 3 palavras**: aplique na hora.
  - **Avançar > 3 palavras**: guarde como "pendente". Aplique só se a transcrição seguinte apontar para até 3 palavras desse pendente. Um avanço pequeno normal descarta o pendente.
  - Ao re-quebrar o texto, **não** recalcule o cursor, porque ele é índice de palavra e não muda com a quebra. Recalcule só o alvo, nunca para trás da posição atual.
- **Alvo de rolagem** = linha da palavra do cursor + (posição na linha ÷ palavras da linha). Cursor no fim = fim do roteiro.
- **Movimento suave até o alvo**: a cada quadro, o passo é `max(|alvo − p| × (1 − e^(−dt/220ms)), 0,0015 linha/ms × dt)`, limitado à distância. Sem a velocidade mínima, a aproximação exponencial nunca chega e a linha demora a virar.
- O modo voz termina quando o cursor chega ao fim e `p` alcança o alvo.
- Alternar voz ↔ velocidade durante a apresentação (botão ou `V`) mantém a posição. Ao entrar no modo voz, o cursor vira a primeira palavra a partir de `p`.

## 7. Reposicionamento manual e atalhos

- `↑`/`PageUp` voltam e `↓`/`PageDown` avançam **uma linha**, alinhando à linha inteira. Isso funciona com passador de slides.
- Roda do mouse ou trackpad reposiciona de forma fina: delta em px ÷ altura da linha em px. Use um listener **não passivo** com `preventDefault`, para não rolar a página por trás. Normalize `deltaMode`: linhas ×16, páginas ×400.
- Ao reposicionar: alvo = nova posição; cursor de voz = primeira palavra a partir dela; descarte o pendente; **descarte o que já foi ouvido**. Para isso, ignore os resultados anteriores e, no resultado atual, só o trecho transcrito depois desse momento. Sem isso, a fala antiga puxa o texto de volta.
- Atalhos globais (ignorar quando o foco estiver em input/textarea/select ou com Ctrl/Alt/Meta):

| Tecla                    | Ação                                            |
| ------------------------ | ----------------------------------------------- |
| Espaço                   | pausar / continuar (na contagem: começar)       |
| ↑ / PageUp, ↓ / PageDown | voltar / avançar uma linha                      |
| `+`/`=`, `−`/`_`         | velocidade ±10 ppm (modo velocidade)            |
| V                        | alternar voz ↔ velocidade                       |
| R                        | reiniciar (com contagem)                        |
| F                        | alternar modo foco                              |
| Esc                      | sair (no modo foco, primeiro sai da tela cheia) |

## 8. Acessibilidade

- Labels em todos os campos.
- Grupo de opções como `fieldset` + `legend` com radios.
- Botões só de ícone com `aria-label`.
- `aria-current` na linha sob a guia.
- Contagem e status em `aria-live`; avisos com `role="alert"`.
- Foco visível e respeito a `prefers-reduced-motion`.

## 9. Critérios de aceite (cubra com testes no padrão do projeto)

- [ ] O parser reconhece parágrafos, pausas (com e sem segundos, vírgula decimal), respira, ênfase com várias palavras, indicações e notas, e preserva a pontuação colada.
- [ ] A quebra de linhas respeita a largura, nunca perde palavras, e uma palavra maior que a largura ocupa a própria linha.
- [ ] Re-quebrar com outra largura mantém o mesmo trecho sob a guia.
- [ ] Modo velocidade: rolagem contínua, proporcional às palavras; pausas somadas só com a opção ligada.
- [ ] Linhas já lidas continuam visíveis acima da guia.
- [ ] Modo voz: o texto acompanha a fala; tolera acentos, plurais, palavras cortadas e puladas; ignora fala fora do roteiro; volta numa repetição real.
- [ ] Uma revisão provisória do reconhecedor (texto ouvido encurta) **não** faz o deslocamento diminuir.
- [ ] Um salto isolado para frente não é seguido sem confirmação.
- [ ] Microfone bloqueado mostra aviso e permite trocar para velocidade.
- [ ] Marcação automática segue as regras, é idempotente e não altera notas. Se houver marcações, o mesmo botão remove todas. Desfazer funciona nos dois sentidos.
- [ ] Modo foco: renderizado fora do contêiner da página e em tela cheia; controles se ocultam.
- [ ] Limpar exige confirmação. Preferências persistem.
- [ ] Marcações exibidas em cores próprias, distintas do texto lido.
- [ ] Apenas componentes e tokens do design system do projeto.

**Para testar o modo voz:** simule a classe de reconhecimento expondo `onresult` com `{ resultIndex, results: [{ isFinal, 0: { transcript } }] }`. Entregue a fala aos poucos, como o navegador faz. Use relógio falso que inclua `requestAnimationFrame` e avance o tempo em passos curtos.

## Fora de escopo

Reconhecimento de fala offline, espelhamento horizontal, ajuste de fonte e largura pelo usuário, controle remoto pelo celular.
