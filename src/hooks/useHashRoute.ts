"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getSnapshot = () => decodeURIComponent(window.location.hash.slice(1));
const getServerSnapshot = () => "";

/**
 * Estado de navegação da tela única guardado no hash da URL (`/#hello-world`).
 * Permite deep-link e uso do botão voltar do navegador sem criar novas rotas.
 */
export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const navigate = useCallback((next: string) => {
    if (next) {
      window.location.hash = encodeURIComponent(next);
    } else {
      // Remove o hash sem deixar "#" sobrando na URL.
      history.pushState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  return [hash, navigate] as const;
}
