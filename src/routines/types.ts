import type { ComponentType, LazyExoticComponent } from "react";

export type RoutineStatus = "stable" | "beta" | "experimental";

/**
 * Contrato que toda rotina exporta em `src/routines/<id>/index.ts`.
 * O hub só conhece rotinas por este manifesto.
 */
export type RoutineManifest = {
  /** kebab-case, igual ao nome da pasta. Usado na URL (`/#<id>`). */
  id: string;
  title: string;
  description: string;
  /** Caractere/emoji curto exibido no card. */
  icon: string;
  status: RoutineStatus;
  tags?: string[];
  /** Componente carregado sob demanda (React.lazy) — mantém o bundle inicial pequeno. */
  component: LazyExoticComponent<ComponentType>;
};
