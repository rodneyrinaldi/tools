// Ponto de entrada público do design system.
// Rotinas e telas importam SEMPRE daqui: `import { Surface } from "@/design-system"`.
export { Surface, type SurfaceProps } from "./components/Surface";
export { Button, type ButtonProps } from "./components/Button";
export { Badge, type BadgeProps } from "./components/Badge";
export { TextField, type TextFieldProps } from "./components/TextField";
export { TextArea, type TextAreaProps } from "./components/TextArea";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./components/SegmentedControl";
export { cx } from "./cx";
