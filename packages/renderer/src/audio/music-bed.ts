import { createSeededRandom, normalizePeak, type PcmAudio } from "@cutroom/audio-io";
import type { MusicBed } from "@cutroom/scene-spec";

const SAMPLE_RATE = 44_100;

/** Chord tones as MIDI notes: Cmaj7 → Am7 → Fmaj7 → G6, a progression no one owns. */
const progression: ReadonlyArray<ReadonlyArray<number>> = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 55, 59],
];

interface BedSettings {
  beatsPerMinute: number;
  beatsPerChord: number;
  padLevel: number;
  arpeggioLevel: number;
  kickLevel: number;
  hatLevel: number;
}

const settingsByBed: Readonly<Record<MusicBed, BedSettings>> = {
  calm: {
    beatsPerMinute: 72,
    beatsPerChord: 8,
    padLevel: 0.5,
    arpeggioLevel: 0.12,
    kickLevel: 0,
    hatLevel: 0,
  },
  upbeat: {
    beatsPerMinute: 112,
    beatsPerChord: 4,
    padLevel: 0.35,
    arpeggioLevel: 0.22,
    kickLevel: 0.5,
    hatLevel: 0.05,
  },
};

function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function triangle(phase: number): number {
  const wrapped = phase - Math.floor(phase);
  return 4 * Math.abs(wrapped - 0.5) - 1;
}

interface Renderer {
  left: Float32Array;
  right: Float32Array;
  frameCount: number;
}

interface LayerOptions {
  renderer: Renderer;
  settings: BedSettings;
  secondsPerBeat: number;
}

function addPad({ renderer, settings, secondsPerBeat }: LayerOptions): void {
  const chordSeconds = settings.beatsPerChord * secondsPerBeat;
  for (let frame = 0; frame < renderer.frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const chordIndex = Math.floor(time / chordSeconds) % progression.length;
    const timeInChord = time % chordSeconds;
    const swell = Math.min(1, timeInChord / 0.8) * Math.min(1, (chordSeconds - timeInChord) / 0.6);
    let leftSample = 0;
    let rightSample = 0;
    for (const note of progression[chordIndex] ?? []) {
      const frequency = midiToHz(note);
      leftSample += Math.sin(2 * Math.PI * frequency * 0.998 * time);
      rightSample += Math.sin(2 * Math.PI * frequency * 1.002 * time);
    }
    renderer.left[frame] = (renderer.left[frame] ?? 0) + (leftSample / 4) * swell * settings.padLevel;
    renderer.right[frame] = (renderer.right[frame] ?? 0) + (rightSample / 4) * swell * settings.padLevel;
  }
}

interface HitOptions {
  startFrame: number;
  lengthFrames: number;
  sample: (timeSinceHit: number) => number;
  pan: number;
}

function addHit(renderer: Renderer, hit: HitOptions): void {
  const endFrame = Math.min(renderer.frameCount, hit.startFrame + hit.lengthFrames);
  for (let frame = hit.startFrame; frame < endFrame; frame += 1) {
    const value = hit.sample((frame - hit.startFrame) / SAMPLE_RATE);
    renderer.left[frame] = (renderer.left[frame] ?? 0) + value * (1 - hit.pan);
    renderer.right[frame] = (renderer.right[frame] ?? 0) + value * (1 + hit.pan);
  }
}

function addRhythm({ renderer, settings, secondsPerBeat, seed }: LayerOptions & { seed: number }): void {
  const random = createSeededRandom(seed);
  const totalEighths = Math.floor(renderer.frameCount / SAMPLE_RATE / (secondsPerBeat / 2));
  for (let eighth = 0; eighth < totalEighths; eighth += 1) {
    const startFrame = Math.round(eighth * (secondsPerBeat / 2) * SAMPLE_RATE);
    const beat = eighth / 2;
    const chord = progression[Math.floor(beat / settings.beatsPerChord) % progression.length] ?? [];
    const arpeggioNote = (chord[eighth % chord.length] ?? 60) + 12;
    const frequency = midiToHz(arpeggioNote);
    addHit(renderer, {
      startFrame,
      lengthFrames: Math.round(0.5 * SAMPLE_RATE),
      pan: (random() - 0.5) * 0.6,
      sample: (time) => triangle(frequency * time) * Math.exp(-time * 7) * settings.arpeggioLevel,
    });
    if (settings.kickLevel > 0 && eighth % 2 === 0) {
      addHit(renderer, {
        startFrame,
        lengthFrames: Math.round(0.3 * SAMPLE_RATE),
        pan: 0,
        sample: (time) =>
          Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-time * 30)) * time) *
          Math.exp(-time * 9) *
          settings.kickLevel,
      });
    }
    if (settings.hatLevel > 0 && eighth % 2 === 1) {
      addHit(renderer, {
        startFrame,
        lengthFrames: Math.round(0.05 * SAMPLE_RATE),
        pan: 0.2,
        sample: (time) => (random() * 2 - 1) * Math.exp(-time * 90) * settings.hatLevel,
      });
    }
  }
}

export interface SynthesizeMusicBedOptions {
  bed: MusicBed;
  durationSeconds: number;
  seed: number;
}

/** A placeholder bed synthesised in code: no third-party licence (FR-MU-1). */
export function synthesizeMusicBed(options: SynthesizeMusicBedOptions): PcmAudio {
  const settings = settingsByBed[options.bed];
  const frameCount = Math.ceil(options.durationSeconds * SAMPLE_RATE);
  const renderer: Renderer = {
    left: new Float32Array(frameCount),
    right: new Float32Array(frameCount),
    frameCount,
  };
  const secondsPerBeat = 60 / settings.beatsPerMinute;
  addPad({ renderer, settings, secondsPerBeat });
  addRhythm({ renderer, settings, secondsPerBeat, seed: options.seed });
  return normalizePeak({ sampleRate: SAMPLE_RATE, channels: [renderer.left, renderer.right] }, -3);
}
