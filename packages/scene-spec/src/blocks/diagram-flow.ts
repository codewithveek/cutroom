import { z } from "zod";
import { iconIdSchema } from "./icons";
import { sceneBaseShape } from "./scene-base";

export const diagramNodeSchema = z.object({
  icon: iconIdSchema.optional(),
  /** What the stage is, as the code names it, e.g. "Parse commits". */
  label: z.string().min(1).max(24),
  /** One short qualifier, e.g. the file or function that does it. */
  detail: z.string().min(1).max(40).optional(),
});

export const diagramFlowPropsSchema = z
  .object({
    heading: z.string().min(1).max(50).optional(),
    nodes: z.array(diagramNodeSchema).min(2).max(5),
    /** Optional words on the connectors, one per gap between consecutive nodes. */
    connectors: z.array(z.string().min(1).max(20)).max(4).optional(),
  })
  .refine((props) => !props.connectors || props.connectors.length === props.nodes.length - 1, {
    message: "Give one connector label per gap between nodes, or none",
    path: ["connectors"],
  });

export const diagramFlowSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("diagram-flow"),
  props: diagramFlowPropsSchema,
});
export type DiagramFlowScene = z.infer<typeof diagramFlowSceneSchema>;
