"use client";

import { useEffect, useState } from "react";
import { cameraErrorMessage, INSECURE_CONTEXT_MESSAGE, type Facing } from "./camera";

type CameraState = {
  stream: MediaStream | null;
  error: string | null;
  /** O stream tem microfone (se não tiver, a gravação sai sem som). */
  hasAudio: boolean;
  /** Quantas câmeras o aparelho tem (para oferecer a troca frontal/traseira). */
  cameraCount: number;
};

const IDLE: CameraState = { stream: null, error: null, hasAudio: false, cameraCount: 0 };

/** Erros em que vale tentar de novo com menos exigências (não reabre o pedido de permissão). */
const RETRYABLE = new Set([
  "NotFoundError",
  "OverconstrainedError",
  "NotReadableError",
  "AbortError",
]);

/**
 * Tentativas em ordem: alta resolução com microfone → resolução livre com microfone →
 * só vídeo. Alguns aparelhos recusam 1080p, outros não têm/negam o microfone.
 */
function attempts(facing: Facing, withAudio: boolean): MediaStreamConstraints[] {
  if (!withAudio) {
    return [
      { video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { facingMode: facing } },
    ];
  }
  const audio = { echoCancellation: true, noiseSuppression: true };
  return [
    {
      video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio,
    },
    { video: { facingMode: facing }, audio },
    { video: { facingMode: facing }, audio: false },
  ];
}

async function openCamera(facing: Facing, withAudio: boolean): Promise<MediaStream> {
  let firstError: unknown;
  for (const constraints of attempts(facing, withAudio)) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      firstError ??= error;
      const name =
        error instanceof Error || error instanceof DOMException ? error.name : "";
      if (!RETRYABLE.has(name)) break;
    }
  }
  throw firstError;
}

/**
 * Liga câmera + microfone enquanto `enabled`; troca de câmera ao mudar `facing`.
 * `withAudio: false` deixa o microfone livre (para o reconhecimento de voz do navegador).
 */
export function useCamera(
  enabled: boolean,
  facing: Facing,
  withAudio = true,
): CameraState {
  const [state, setState] = useState<CameraState>(IDLE);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let current: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => {
        if (!cancelled) setState({ ...IDLE, error: INSECURE_CONTEXT_MESSAGE });
      });
      return () => {
        cancelled = true;
      };
    }

    openCamera(facing, withAudio)
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        current = stream;
        // Depois da permissão, a lista de dispositivos revela todas as câmeras.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (cancelled) return;
        setState({
          stream,
          error: null,
          hasAudio: (stream.getAudioTracks?.().length ?? 0) > 0,
          cameraCount: devices.filter((device) => device.kind === "videoinput").length,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ ...IDLE, error: cameraErrorMessage(error) });
      });

    return () => {
      cancelled = true;
      current?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, facing, withAudio]);

  return enabled ? state : IDLE;
}
