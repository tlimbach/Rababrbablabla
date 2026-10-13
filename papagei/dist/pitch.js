// Waveform-aligned overlap-add: stretch first, then resample to the original
// length. Matching the overlap avoids the fixed-grain phase cancellations.
export function raisePitch(input, sampleRate, semitones = 4) {
  if (!input.length) return new Float32Array();
  const ratio = 2 ** (semitones / 12);
  const hop = Math.round(sampleRate * .02);
  const grain = hop * 2;
  const search = Math.round(sampleRate * .012);
  const length = Math.ceil(input.length * ratio);
  const stretched = new Float32Array(length + grain);
  const read = i => input[Math.max(0, Math.min(input.length - 1, i))];
  for (let i = 0; i < grain; i++) stretched[i] = read(i);
  for (let dest = hop; dest < length; dest += hop) {
    const expected = Math.round(dest / ratio);
    const low = Math.max(0, expected - search);
    const high = Math.min(input.length - 1, expected + search);
    let best = Math.min(expected, input.length - 1), bestScore = -Infinity;
    const score = candidate => {
      let cross = 0, energyA = 0, energyB = 0;
      for (let j = 0; j < hop; j += 4) {
        const a = stretched[dest + j], b = read(candidate + j);
        cross += a * b; energyA += a * a; energyB += b * b;
      }
      // Small distance preference stabilizes silence and ambiguous matches.
      return cross / Math.sqrt(energyA * energyB + 1e-20)
        - .001 * Math.abs(candidate - expected) / search;
    };
    for (let candidate = low; candidate <= high; candidate += 4) {
      const value = score(candidate);
      if (value > bestScore) { bestScore = value; best = candidate; }
    }
    const coarse = best;
    for (let candidate = Math.max(low, coarse - 3); candidate <= Math.min(high, coarse + 3); candidate++) {
      const value = score(candidate);
      if (value > bestScore) { bestScore = value; best = candidate; }
    }
    for (let j = 0; j < hop; j++) {
      const fade = .5 - .5 * Math.cos(Math.PI * j / (hop - 1));
      stretched[dest + j] = stretched[dest + j] * (1 - fade) + read(best + j) * fade;
      stretched[dest + hop + j] = read(best + hop + j);
    }
  }
  const output = new Float32Array(input.length);
  for (let i = 0; i < output.length; i++) {
    const position = i * ratio, index = Math.floor(position), fraction = position - index;
    output[i] = stretched[index] * (1 - fraction) + stretched[index + 1] * fraction;
  }
  return output;
}
