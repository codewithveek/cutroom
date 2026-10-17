import { useEffect, useRef, useState } from "react";
import { useDelayRender } from "remotion";
import { type CodeToken, type HighlightCodeOptions, highlightCode, plainTokens } from "./highlight-code";

/** Highlights with Shiki and holds the render until tokens are ready. */
export function useHighlightedCode(options: HighlightCodeOptions): CodeToken[][] {
  const { code, language, theme } = options;
  const [tokens, setTokens] = useState<CodeToken[][]>(() => plainTokens(code));
  const renderControl = useDelayRender();
  const renderControlRef = useRef(renderControl);
  renderControlRef.current = renderControl;
  const [handle] = useState(() => renderControl.delayRender(`Highlighting ${language} code`));
  useEffect(() => {
    let isCurrent = true;
    highlightCode({ code, language, theme })
      .then((highlighted) => {
        if (isCurrent) setTokens(highlighted);
        renderControlRef.current.continueRender(handle);
      })
      .catch((error: unknown) => renderControlRef.current.cancelRender(error));
    return () => {
      isCurrent = false;
    };
  }, [code, language, theme, handle]);
  return tokens;
}
