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

export class WavDecodeError extends Error {
  override readonly name = "WavDecodeError";
}

interface WavFormat {
  audioFormat: number;
  channelCount: number;
  sampleRate: number;
  bitsPerSample: number;
}

function readFormat(buffer: Buffer, offset: number): WavFormat {
  return {
    audioFormat: buffer.readUInt16LE(offset),
    channelCount: buffer.readUInt16LE(offset + 2),
    sampleRate: buffer.readUInt32LE(offset + 4),
    bitsPerSample: buffer.readUInt16LE(offset + 14),
  };
}

function readSample({
  buffer,
  offset,
  format,
}: {
  buffer: Buffer;
  offset: number;
  format: WavFormat;
}): number {
  if (format.audioFormat === 3 && format.bitsPerSample === 32) return buffer.readFloatLE(offset);
  if (format.audioFormat === 1 && format.bitsPerSample === 16) return buffer.readInt16LE(offset) / 32768;
  throw new WavDecodeError(
    `Unsupported WAV encoding (format ${format.audioFormat}, ${format.bitsPerSample} bits)`,
  );
}

function readDataChunk(options: {
  buffer: Buffer;
  bodyOffset: number;
  chunkSize: number;
  format: WavFormat;
}): PcmAudio {
  const { buffer, bodyOffset, format } = options;
  const bytesPerSample = format.bitsPerSample / 8;
  const availableBytes = Math.min(options.chunkSize, buffer.length - bodyOffset);
  const frameCount = Math.floor(availableBytes / (bytesPerSample * format.channelCount));
  const channels = Array.from({ length: format.channelCount }, () => new Float32Array(frameCount));
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    channels.forEach((channel, channelIndex) => {
      const sampleOffset = bodyOffset + (frameIndex * format.channelCount + channelIndex) * bytesPerSample;
      channel[frameIndex] = readSample({ buffer, offset: sampleOffset, format });
    });
  }
  return { sampleRate: format.sampleRate, channels };
}

/** Reads 16-bit PCM and 32-bit float WAVs (Kokoro writes float; read it as float). */
export function decodeWav(buffer: Buffer): PcmAudio {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new WavDecodeError("Not a RIFF/WAVE file");
  }
  let format: WavFormat | undefined;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const bodyOffset = offset + 8;
    if (chunkId === "fmt ") format = readFormat(buffer, bodyOffset);
    if (chunkId === "data") {
      if (!format) throw new WavDecodeError("data chunk before fmt chunk");
      return readDataChunk({ buffer, bodyOffset, chunkSize, format });
    }
    offset = bodyOffset + chunkSize + (chunkSize % 2);
  }
  throw new WavDecodeError("No data chunk");
}

export function durationMsOf(audio: PcmAudio): number {
  return Math.round(((audio.channels[0]?.length ?? 0) / audio.sampleRate) * 1000);
}
