import type { Scene } from "@cutroom/scene-spec";
import React from "react";
import { BigNumberBlock } from "./big-number-block";
import { CodeCardBlock } from "./code-card-block";
import { DiagramFlowBlock } from "./diagram-flow-block";
import { EndCardBlock } from "./end-card-block";
import { FeatureCardsBlock } from "./feature-cards-block";
import { KineticHeadlineBlock } from "./kinetic-headline-block";
import { TerminalBlock } from "./terminal-block";
import { TitleCardBlock } from "./title-card-block";
import { WordSlotBlock } from "./word-slot-block";

/** The fixed, tested block library that renders model-written JSON (P3). */
export function SceneBlock(props: { scene: Scene }): React.ReactElement {
  const { scene } = props;
  switch (scene.block) {
    case "title-card":
      return <TitleCardBlock scene={scene} />;
    case "kinetic-headline":
      return <KineticHeadlineBlock scene={scene} />;
    case "big-number":
      return <BigNumberBlock scene={scene} />;
    case "feature-cards":
      return <FeatureCardsBlock scene={scene} />;
    case "code-card":
      return <CodeCardBlock scene={scene} />;
    case "terminal":
      return <TerminalBlock scene={scene} />;
    case "word-slot":
      return <WordSlotBlock scene={scene} />;
    case "end-card":
      return <EndCardBlock scene={scene} />;
    case "diagram-flow":
      return <DiagramFlowBlock scene={scene} />;
  }
}
