import type { RoutineManifest } from "./types";
import helloWorld from "./hello-world";
import teleprompter from "./teleprompter";

/**
 * Registro central de rotinas, na ordem de exibição do hub.
 * Para adicionar uma rotina, use a skill `/new-routine` (ver .claude/skills).
 */
export const routines: readonly RoutineManifest[] = [teleprompter, helloWorld];

export function findRoutine(id: string): RoutineManifest | undefined {
  return routines.find((routine) => routine.id === id);
}
