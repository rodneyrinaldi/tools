import { lazy } from "react";
import type { RoutineManifest } from "../types";

const pdfTools: RoutineManifest = {
  id: "pdf-tools",
  title: "Ferramentas de PDF",
  description:
    "Junte, comprima, converta para A4, proteja ou desproteja PDFs de uma pasta.",
  icon: "📄",
  status: "beta",
  tags: ["pdf", "arquivos"],
  component: lazy(() => import("./PdfTools")),
};

export default pdfTools;
