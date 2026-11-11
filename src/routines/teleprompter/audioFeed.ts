"use client";

/**
 * Entrega o áudio de um MediaStream em blocos Float32 (mono, −1…1), para o reconhecedor
 * no aparelho. Usa AudioWorklet (fora da thread principal, não atrapalha a rolagem) e cai
 * para ScriptProcessor nos navegadores sem ele.
 */
export type AudioFeed = { sampleRate: number; close: () => void };

/** ~85 ms a 48 kHz: blocos grandes o bastante para não sobrecarregar o worker. */
const CHUNK_FRAMES = 4096;

const WORKLET_SOURCE = `
class ChunkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(${CHUNK_FRAMES});
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      let offset = 0;
      while (offset < channel.length) {
        const count = Math.min(channel.length - offset, this.buffer.length - this.filled);
        this.buffer.set(channel.subarray(offset, offset + count), this.filled);
        this.filled += count;
        offset += count;
        if (this.filled === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(${CHUNK_FRAMES});
          this.filled = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("tp-chunks", ChunkProcessor);
`;

type AudioContextConstructor = typeof AudioContext;

export async function openAudioFeed(
  stream: MediaStream,
  onChunk: (samples: Float32Array, sampleRate: number) => void,
): Promise<AudioFeed> {
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: AudioContextConstructor })
      .webkitAudioContext;
  const context = new Context();
  // Criado fora do toque da pessoa, pode nascer suspenso.
  await context.resume().catch(() => {});
  const source = context.createMediaStreamSource(stream);
  const sampleRate = context.sampleRate;
  // Nó mudo no fim da cadeia: o processamento só roda ligado à saída, mas sem som.
  const mute = context.createGain();
  mute.gain.value = 0;
  mute.connect(context.destination);

  let node: AudioNode;
  if (context.audioWorklet) {
    const url = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
    );
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const worklet = new AudioWorkletNode(context, "tp-chunks");
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) =>
      onChunk(event.data, sampleRate);
    node = worklet;
  } else {
    const processor = context.createScriptProcessor(CHUNK_FRAMES, 1, 1);
    processor.onaudioprocess = (event) =>
      onChunk(new Float32Array(event.inputBuffer.getChannelData(0)), sampleRate);
    node = processor;
  }
  source.connect(node);
  node.connect(mute);

  return {
    sampleRate,
    close: () => {
      source.disconnect();
      node.disconnect();
      void context.close().catch(() => {});
    },
  };
}
