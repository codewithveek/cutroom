import { shipnoteBriefDraft, shipnoteStoryboardDraft } from "@cutroom/agent";
import {
  createScriptedTransport,
  type JsonCompletionRequest,
  type JsonCompletionTransport,
} from "@cutroom/providers";

interface CitedLine {
  filePath: string;
  line: number;
  text: string;
}

/** The first non-empty numbered line in a claim's evidence block, with the file it belongs to. */
function firstCitedLine(block: string): CitedLine | undefined {
  let currentFile: string | undefined;
  for (const line of block.split("\n")) {
    const fileMatch = line.match(/^ {4}(\S.*)$/);
    if (fileMatch?.[1]) {
      currentFile = fileMatch[1];
      continue;
    }
    const numbered = line.match(/^\s+(\d+)\| (.*)$/);
    if (currentFile && numbered?.[1] && numbered[2]?.trim()) {
      return { filePath: currentFile, line: Number(numbered[1]), text: numbered[2] };
    }
  }
  return undefined;
}

/** Reads the first cited line under each claim id in a judge prompt. */
function firstCitedLinePerClaim(prompt: string): Map<string, CitedLine | undefined> {
  const cited = new Map<string, CitedLine | undefined>();
  for (const block of prompt.split(/\n(?=- id: )/)) {
    const claimId = block.match(/^- id: (\S+)/m)?.[1];
    if (claimId) cited.set(claimId, firstCitedLine(block));
  }
  return cited;
}

function judgeFromSnippets(request: JsonCompletionRequest) {
  const cited = firstCitedLinePerClaim(request.messages[0]?.content ?? "");
  return {
    verdicts: [...cited.entries()].map(([claimId, line]) =>
      line
        ? {
            claimId,
            verdict: "supported",
            reason: "The cited line shows it.",
            evidence: [
              {
                filePath: line.filePath,
                lineStart: line.line,
                lineEnd: line.line,
                excerpt: line.text.trim().slice(0, 400),
              },
            ],
          }
        : {
            claimId,
            verdict: "weak",
            reason: "No matching code was found.",
            evidence: [],
            rewrite: "Say what the code shows.",
          },
    ),
  };
}

/**
 * With captured screens in the prompt, the last moment headline becomes a screenshot-window on the
 * first screen, aimed at its first labelled element, as a real model is asked to do.
 */
function storyboardFor(request: JsonCompletionRequest) {
  const prompt = request.messages[0]?.content ?? "";
  const listed = prompt.match(/^- (screen-\d+) · route .*?focusText options: "([^"]+)"/m);
  if (!listed?.[1]) return shipnoteStoryboardDraft;
  const [, screenId, focusText] = listed;
  const replaced = shipnoteStoryboardDraft.scenes.findLastIndex(
    (scene) => scene.beat === "moment" && scene.block === "kinetic-headline",
  );
  return {
    ...shipnoteStoryboardDraft,
    scenes: shipnoteStoryboardDraft.scenes.map((scene, index) =>
      index === replaced
        ? {
            beat: "moment",
            block: "screenshot-window",
            props: { screenId, ...(focusText ? { focusText } : {}) },
            narration: [{ text: "Here it is in the running app." }],
          }
        : scene,
    ),
  };
}

/** Answers a regenerate request with the fixture draft's scene for the same beat. */
function regeneratedSceneFor(request: JsonCompletionRequest) {
  const beat = request.messages[0]?.content.match(/\(beat "([^"]+)"\)/)?.[1];
  const scenes = shipnoteStoryboardDraft.scenes.filter((scene) => scene.beat === beat);
  const scene = scenes.at(-1) ?? shipnoteStoryboardDraft.scenes[0];
  return { scene };
}

/**
 * A scripted model for the shipnote fixture: what a well-behaved Gemma answers, without a GPU.
 * The CI end-to-end test and `cutroom make --scripted` use it. Not for real repositories.
 */
export function createShipnoteScriptedTransport(): JsonCompletionTransport {
  return createScriptedTransport((request) => {
    switch (request.schemaName) {
      case "product_brief":
        return shipnoteBriefDraft;
      case "directory_summary":
        return { summary: "Parses conventional commits and writes a changelog.", candidateFeatures: [] };
      case "storyboard_draft":
        return storyboardFor(request);
      case "claim_verdicts":
        return judgeFromSnippets(request);
      case "scene_draft":
        return regeneratedSceneFor(request);
      default:
        throw new Error(`The shipnote script has no answer for ${request.schemaName}`);
    }
  }, "scripted-shipnote");
}
