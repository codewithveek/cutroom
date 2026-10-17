export interface PcmAudio {
  sampleRate: number;
  /** One Float32Array per channel, samples in [-1, 1]. */
  channels: ReadonlyArray<Float32Array>;
}

/** 16-bit PCM WAV; interleaves channels. */
export function encodeWav(audio: PcmAudio): Buffer {
  const channelCount = audio.channels.length;
  const frameCount = audio.channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataBytes = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(audio.sampleRate, 24);
  buffer.writeUInt32LE(audio.sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (const channel of audio.channels) {
      const sample = Math.max(-1, Math.min(1, channel[frameIndex] ?? 0));
      buffer.writeInt16LE(Math.round(sample * 32767), offset);
      offset += bytesPerSample;
    }
  }
  return buffer;
}

/** Scales every channel so the loudest sample sits at `targetPeakDbfs`. */
export function normalizePeak(audio: PcmAudio, targetPeakDbfs: number): PcmAudio {
  let peak = 0;
  for (const channel of audio.channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0) return audio;
  const gain = 10 ** (targetPeakDbfs / 20) / peak;
  return {
    sampleRate: audio.sampleRate,
    channels: audio.channels.map((channel) => channel.map((sample) => sample * gain)),
  };
}
