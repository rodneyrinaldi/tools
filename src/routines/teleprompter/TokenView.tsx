import { cx } from "@/design-system";
import type { TextStyle } from "./format";
import { tokenLabel, type Token } from "./script";
import styles from "./TokenView.module.css";

/** Classes CSS do estilo de uma palavra formatada. */
function styleClasses(style: TextStyle | undefined) {
  if (!style) return undefined;
  return cx(
    style.color && styles[`color-${style.color}`],
    style.size && styles[`size-${style.size}`],
    style.font && styles[`font-${style.font}`],
    style.bold && styles.bold,
    style.italic && styles.italic,
    style.underline && styles.underline,
    style.highlight && styles.highlight,
  );
}

/** Uma palavra, marcação ou indicação do roteiro, com espaço antes quando não está colada. */
export function TokenView({ token, first }: { token: Token; first: boolean }) {
  const space = first || token.glue ? "" : " ";

  if (token.kind === "word") {
    const className = cx(token.emphasis && styles.emphasis, styleClasses(token.style));
    return (
      <>
        {space}
        {className ? <span className={className}>{token.text}</span> : token.text}
      </>
    );
  }

  return (
    <>
      {space}
      <span
        className={cx(
          styles.marker,
          token.kind === "cue" ? styles.cue : token.breath ? styles.breath : styles.pause,
        )}
      >
        {tokenLabel(token)}
      </span>
    </>
  );
}
