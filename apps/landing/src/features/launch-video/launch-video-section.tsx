import type React from "react";
import { LaunchVideo } from "./launch-video";

export function LaunchVideoSection(): React.ReactElement {
  return (
    <section id="video" aria-label="Cutroom's launch video" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <LaunchVideo />
    </section>
  );
}
