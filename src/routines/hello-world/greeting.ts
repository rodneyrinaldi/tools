/** Lógica pura da rotina — mantida fora do componente para ser testável. */
export function buildGreeting(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Olá, ${trimmed}!` : "Olá, mundo!";
}
