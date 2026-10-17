import React, { createContext, type ReactNode, useContext } from "react";
import { editorialLook } from "./editorial";
import type { LookTokens } from "./look-tokens";

const LookContext = createContext<LookTokens>(editorialLook);

export function LookProvider(props: { look: LookTokens; children: ReactNode }): React.ReactElement {
  return <LookContext.Provider value={props.look}>{props.children}</LookContext.Provider>;
}

export function useLook(): LookTokens {
  return useContext(LookContext);
}
