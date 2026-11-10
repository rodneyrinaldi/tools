"use client";

import { useEffect, useState } from "react";
import { cameraErrorMessage, INSECURE_CONTEXT_MESSAGE, type Facing } from "./camera";

type CameraState = {
  stream: MediaStream | null;
  error: string | null;
  /** Quantas câmeras o aparelho tem (para oferecer a troca frontal/traseira). */
  cameraCount: number;
};

const IDLE: CameraState = { stream: null, error: null, cameraCount: 0 };

/** Liga câmera + microfone enquanto `enabled`; troca de câmera ao mudar `facing`. */
export function useCamera(enabled: boolean, facing: Facing): CameraState {
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

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
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
  }, [enabled, facing]);

  return enabled ? state : IDLE;
}
