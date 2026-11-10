const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** O cabeçalho Host aponta para o próprio computador? */
export function isLocalHost(host: string | null): boolean {
  const hostname = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  return LOCAL_HOSTS.has(hostname);
}
