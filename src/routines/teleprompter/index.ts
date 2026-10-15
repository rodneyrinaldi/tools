import { lazy } from "react";
import type { RoutineManifest } from "../types";

const teleprompter: RoutineManifest = {
  id: "teleprompter",
  title: "Teleprompter",
  description: "Leia olhando para a câmera: o texto rola e acompanha a sua voz.",
  icon: "🎬",
  status: "beta",
  tags: ["vídeo", "apresentação"],
  component: lazy(() => import("./Teleprompter")),
};

export default teleprompter;
