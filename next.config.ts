import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `npm run dev:celular`: permite abrir o servidor de desenvolvimento pelo IP da rede local
  // (ex.: https://192.168.0.10:3000 no celular). Só vale em desenvolvimento.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Modelo de voz do teleprompter (~32 MB): o nome tem a versão, então pode ficar em cache
  // para sempre — baixa uma vez por aparelho.
  async headers() {
    return [
      {
        source: "/models/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
