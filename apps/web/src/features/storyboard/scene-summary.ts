import { type ClaimResult, type ClaimVerdict, type Scene, stripStars } from "@cutroom/scene-spec";

export function sceneHeadline(scene: Scene): string {
  switch (scene.block) {
    case "title-card":
      return scene.props.name;
    case "kinetic-headline":
      return stripStars(scene.props.lines.join(" "));
    case "big-number":
      return `${scene.props.value} ${scene.props.label}`;
    case "feature-cards":
      return scene.props.heading ?? scene.props.cards.map((card) => card.title).join(" · ");
    case "code-card":
      return scene.props.filePath;
    case "terminal":
      return scene.props.commands.map((command) => `$ ${command.command}`).join(" ; ");
    case "word-slot":
      return `${scene.props.lead} ${scene.props.items[0] ?? ""}…`;
    case "end-card":
      return `${scene.props.name} · ${scene.props.cta}`;
    case "screenshot-window":
      return scene.props.caption ?? scene.props.focusText ?? scene.props.screenId;
    case "diagram-flow":
      return scene.props.heading ?? scene.props.nodes.map((node) => node.label).join(" → ");
  }
}

const verdictRank: Readonly<Record<ClaimVerdict, number>> = { supported: 0, weak: 1, unsupported: 2 };

/** The worst verdict among a scene's claims: the scene card's audit badge. */
export function sceneVerdict(
  sceneId: string,
  claimResults: ReadonlyArray<ClaimResult>,
): ClaimVerdict | undefined {
  const verdicts = claimResults
    .filter((result) => result.sceneId === sceneId)
    .map((result) => result.verdict);
  if (verdicts.length === 0) return undefined;
  return verdicts.reduce((worst, verdict) => (verdictRank[verdict] > verdictRank[worst] ? verdict : worst));
}
