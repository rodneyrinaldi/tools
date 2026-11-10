import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `npm run dev:celular`: permite abrir o servidor de desenvolvimento pelo IP da rede local
  // (ex.: https://192.168.0.10:3000 no celular). Só vale em desenvolvimento.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
