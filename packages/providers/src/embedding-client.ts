import { createHash } from "node:crypto";
import type { CutroomEnv } from "@cutroom/config";
import type { PrivacyMode } from "@cutroom/scene-spec";
import { z } from "zod";
import { ModelTransportError } from "./ollama-transport";
import { assertProviderAllowed, type NetworkScope, networkScopeForUrl } from "./privacy-guard";

/** The code index's vector size: nomic-embed-text and EmbeddingGemma both return 768. */
export const CODE_EMBEDDING_DIMENSIONS = 768;

/** Turns text into vectors for code retrieval (FR-ING-6). One vector per input, same order. */
export interface EmbeddingClient {
  providerId: string;
  modelId: string;
  dimensions: number;
  networkScope: NetworkScope;
  embed(texts: ReadonlyArray<string>): Promise<number[][]>;
}

export class EmbeddingDimensionError extends Error {
  override readonly name = "EmbeddingDimensionError";
}

const ollamaEmbedResponseSchema = z.object({ embeddings: z.array(z.array(z.number())) });
const EMBED_BATCH_SIZE = 32;

/** Ollama's /api/embed, batched. Vectors of the wrong size fail loudly instead of corrupting the index. */
export function createOllamaEmbeddingClient(options: {
  host: string;
  modelId: string;
  dimensions: number;
}): EmbeddingClient {
  const endpoint = new URL("/api/embed", options.host).toString();
  return {
    providerId: "ollama",
    modelId: options.modelId,
    dimensions: options.dimensions,
    networkScope: networkScopeForUrl(endpoint),
    async embed(texts) {
      const vectors: number[][] = [];
      for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: options.modelId,
            input: texts.slice(start, start + EMBED_BATCH_SIZE),
          }),
        });
        if (!response.ok)
          throw new ModelTransportError(`Ollama embed failed: ${await response.text()}`, response.status);
        const { embeddings } = ollamaEmbedResponseSchema.parse(await response.json());
        for (const vector of embeddings) {
          if (vector.length !== options.dimensions)
            throw new EmbeddingDimensionError(
              `${options.modelId} returned ${vector.length} dimensions; the index expects ${options.dimensions}`,
            );
          vectors.push(vector);
        }
      }
      return vectors;
    },
  };
}

function normalise(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((value) => value / length);
}

/**
 * A deterministic, offline embedder: hashed bag of word stems. No model, no network. Good enough
 * for tests and the scripted demo, where it finds chunks that share words with the claim.
 */
export function createHashingEmbeddingClient(options: { dimensions: number }): EmbeddingClient {
  return {
    providerId: "hashing",
    modelId: `hashing-${options.dimensions}`,
    dimensions: options.dimensions,
    networkScope: "none",
    async embed(texts) {
      return texts.map((text) => {
        const vector = new Array<number>(options.dimensions).fill(0);
        const words = text
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length >= 3)
          .map((word) => word.replace(/(ing|ed|es|s)$/, ""));
        for (const word of words) {
          const digest = createHash("sha256").update(word).digest();
          const slot = digest.readUInt32BE(0) % options.dimensions;
          vector[slot] = (vector[slot] ?? 0) + ((digest[4] ?? 0) % 2 === 0 ? 1 : -1);
        }
        return normalise(vector);
      });
    },
  };
}

export interface CreateEmbeddingClientOptions {
  mode: PrivacyMode;
  env: Pick<CutroomEnv, "EMBEDDINGS" | "OLLAMA_HOST" | "EMBEDDING_MODEL_ID">;
  dimensions: number;
}

/** The run's embedder, or undefined when retrieval is off. The privacy guard applies as for models. */
export function createEmbeddingClient(options: CreateEmbeddingClientOptions): EmbeddingClient | undefined {
  if (options.env.EMBEDDINGS === "off") return undefined;
  const client =
    options.env.EMBEDDINGS === "hashing"
      ? createHashingEmbeddingClient({ dimensions: options.dimensions })
      : createOllamaEmbeddingClient({
          host: options.env.OLLAMA_HOST,
          modelId: options.env.EMBEDDING_MODEL_ID,
          dimensions: options.dimensions,
        });
  assertProviderAllowed({
    mode: options.mode,
    provider: { providerId: client.providerId, role: "embedding", networkScope: client.networkScope },
  });
  return client;
}
