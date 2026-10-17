import { createSeededRandom } from "./seeded-random";
import { normalizePeak, type PcmAudio } from "./wav";

const SAMPLE_RATE = 44_100;

/** A soft air whoosh: filtered noise whose cutoff sweeps up and back down. Made in code (CC0). */
export function synthesizeWhoosh(seed: number): PcmAudio {
  const random = createSeededRandom(seed);
  const durationSeconds = 0.7;
  const frameCount = Math.round(durationSeconds * SAMPLE_RATE);
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  let lowpassLeft = 0;
  let lowpassRight = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const progress = frame / frameCount;
    const envelope = Math.sin(Math.PI * progress) ** 2;
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * progress);
    lowpassLeft += cutoff * (random() * 2 - 1 - lowpassLeft);
    lowpassRight += cutoff * (random() * 2 - 1 - lowpassRight);
    const pan = progress * 2 - 1;
    left[frame] = lowpassLeft * envelope * (1 - pan * 0.5);
    right[frame] = lowpassRight * envelope * (1 + pan * 0.5);
  }
  return normalizePeak({ sampleRate: SAMPLE_RATE, channels: [left, right] }, -1);
}

/** A short, soft UI click. */
export function synthesizeClick(): PcmAudio {
  const frameCount = Math.round(0.03 * SAMPLE_RATE);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    samples[frame] = Math.sin(2 * Math.PI * 1800 * time) * Math.exp(-time * 220);
  }
  return normalizePeak({ sampleRate: SAMPLE_RATE, channels: [samples, samples] }, -1);
}
