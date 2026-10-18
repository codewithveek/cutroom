import type { Claim, ClaimKind } from "./claims";
import type { BlockId, Scene, SceneOfBlock } from "./scene";
import type { Storyboard } from "./storyboard";

type ClaimField = Omit<Claim, "id" | "sceneId">;

function field(fieldPath: string, text: string): ClaimField {
  return { fieldPath, text, kind: "text" };
}

function typedField(kind: ClaimKind, claim: { fieldPath: string; text: string }): ClaimField {
  return { ...claim, kind };
}

type ClaimFieldExtractor<Block extends BlockId> = (scene: SceneOfBlock<Block>) => ClaimField[];

/** The props of each block that assert something about the product (PRD §7.7 "claim fields"). */
const claimFieldExtractors: { [Block in BlockId]: ClaimFieldExtractor<Block> } = {
  "title-card": (scene) => [
    field("props.name", scene.props.name),
    field("props.tagline", scene.props.tagline),
  ],
  "kinetic-headline": (scene) => scene.props.lines.map((line, index) => field(`props.lines.${index}`, line)),
  "big-number": (scene) => [
    typedField("number", { fieldPath: "props.value", text: String(scene.props.value) }),
    field("props.label", scene.props.label),
    field("props.line", scene.props.line),
  ],
  "feature-cards": (scene) =>
    scene.props.cards.flatMap((card, index) => [
      field(`props.cards.${index}.title`, card.title),
      field(`props.cards.${index}.line`, card.line),
    ]),
  "code-card": (scene) => [
    {
      ...typedField("code-excerpt", { fieldPath: "props.code", text: scene.props.code }),
      source: {
        filePath: scene.props.filePath,
        lineStart: scene.props.lineStart,
        lineEnd: scene.props.lineEnd,
      },
    },
  ],
  terminal: (scene) =>
    scene.props.commands.flatMap((command, index) => [
      typedField("command", { fieldPath: `props.commands.${index}.command`, text: command.command }),
      ...command.output.map((outputLine, outputIndex) =>
        typedField("command", {
          fieldPath: `props.commands.${index}.output.${outputIndex}`,
          text: outputLine,
        }),
      ),
    ]),
  "word-slot": (scene) => scene.props.items.map((item, index) => field(`props.items.${index}`, item)),
  "diagram-flow": (scene) => [
    ...(scene.props.heading ? [field("props.heading", scene.props.heading)] : []),
    ...scene.props.nodes.flatMap((node, index) => [
      field(`props.nodes.${index}.label`, node.label),
      ...(node.detail ? [field(`props.nodes.${index}.detail`, node.detail)] : []),
    ]),
  ],
  "end-card": (scene) => [
    field("props.tagline", scene.props.tagline),
    field("props.cta", scene.props.cta),
    ...(scene.props.url ? [typedField("url", { fieldPath: "props.url", text: scene.props.url })] : []),
  ],
};

function blockClaimFields(scene: Scene): ClaimField[] {
  // Each extractor is keyed by its own block, so this lookup is sound; TS cannot correlate the union.
  const extractor = claimFieldExtractors[scene.block] as ClaimFieldExtractor<BlockId>;
  return extractor(scene);
}

function narrationClaimFields(scene: Scene): ClaimField[] {
  return scene.narration.map((line, index) =>
    typedField("narration", { fieldPath: `narration.${index}.text`, text: line.text }),
  );
}

export function collectSceneClaims(scene: Scene): Claim[] {
  return [...blockClaimFields(scene), ...narrationClaimFields(scene)]
    .filter((claimField) => claimField.text.trim().length > 0)
    .map((claimField) => ({ ...claimField, id: `${scene.id}:${claimField.fieldPath}`, sceneId: scene.id }));
}

/** Every claim field from every scene, per the block registry (FR-CA-1). */
export function collectClaims(storyboard: Storyboard): Claim[] {
  return storyboard.scenes.flatMap(collectSceneClaims);
}
