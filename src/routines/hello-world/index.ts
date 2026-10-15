import { lazy } from "react";
import type { RoutineManifest } from "../types";

const helloWorld: RoutineManifest = {
  id: "hello-world",
  title: "Olá Mundo",
  description: "Rotina de exemplo: cumprimenta você pelo nome.",
  icon: "👋",
  status: "stable",
  tags: ["exemplo"],
  component: lazy(() => import("./HelloWorld")),
};

export default helloWorld;
