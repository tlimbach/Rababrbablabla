// A fresh, gently wandering tempo for each phrase, always within 0.7–0.9.
export function tempoCurve(duration, random = Math.random) {
  const step = .025;
  // Cover the entire phrase even at the slowest playback rate.
  const values = new Float32Array(Math.ceil(duration / .7 / step) + 1);
  const base = .745 + random() * .11;
  let from = 0, target = (random() * 2 - 1) * .04;
  let segmentStart = 0, segmentLength = .22 + random() * .23;
  for (let i = 0; i < values.length; i++) {
    const time = i * step;
    while (time > segmentStart + segmentLength) {
      segmentStart += segmentLength; from = target;
      target = (random() * 2 - 1) * .04;
      segmentLength = .22 + random() * .23;
    }
    const blend = .5 - .5 * Math.cos(Math.PI * (time - segmentStart) / segmentLength);
    values[i] = base + from + (target - from) * blend;
  }
  return { values, duration: (values.length - 1) * step };
}

export function connectToyVoice(context, source) {
  const lowCut = context.createBiquadFilter();
  lowCut.type = 'highpass'; lowCut.frequency.value = 220; lowCut.Q.value = .7;
  const nasal = context.createBiquadFilter();
  nasal.type = 'peaking'; nasal.frequency.value = 1250; nasal.Q.value = 1.1; nasal.gain.value = 5;
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass'; soften.frequency.value = 5500; soften.Q.value = .7;
  const level = context.createGain(); level.gain.value = .65;
  source.connect(lowCut); lowCut.connect(nasal); nasal.connect(soften);
  soften.connect(level); level.connect(context.destination);
  return () => { source.disconnect(); for (const node of [lowCut, nasal, soften, level]) node.disconnect(); };
}
