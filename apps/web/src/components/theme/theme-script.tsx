import type React from "react";
import { themeBootstrapScript } from "@/lib/theme";

export function ThemeScript(): React.ReactElement {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script that sets the theme before paint
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />;
}
