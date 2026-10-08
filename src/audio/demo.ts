export const SAMPLE_RATE = 48000,
  DEMO_SECONDS = 8;
export function guitarDemo(seconds = DEMO_SECONDS): Float32Array {
  const fs = SAMPLE_RATE,
    out = new Float32Array(Math.round(fs * seconds));
  let seed = 0x424432;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const notes = [
    40, 47, 52, 55, 57, 55, 52, 47, 43, 50, 55, 59, 57, 55, 50, 47,
  ];
  for (let n = 0; n < notes.length; n++) {
    const start = Math.round((0.08 + n * 0.46) * fs),
      freq = 440 * 2 ** ((notes[n] - 69) / 12),
      block = new Float64Array(Math.round(fs / freq));
    let mean = 0;
    for (let j = 0; j < block.length; j++) {
      block[j] = random();
      mean += block[j];
    }
    mean /= block.length;
    for (let j = 0; j < block.length; j++) block[j] -= mean;
    let prev = block[block.length - 1];
    for (let j = 0; j < Math.round(1.7 * fs) && start + j < out.length; j++) {
      const k = j % block.length,
        now = block[k];
      out[start + j] +=
        0.07 * now * Math.min(1, j / (0.002 * fs)) * Math.exp(-j / (fs * 1.1));
      block[k] = 0.498 * (now + prev);
      prev = now;
    }
  }
  for (
    let i = Math.max(0, out.length - Math.round(0.06 * fs));
    i < out.length;
    i++
  )
    out[i] *= (out.length - i) / (0.06 * fs);
  return out;
}
