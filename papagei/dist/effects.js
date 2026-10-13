/** Slow modulated delays create a floating chorus, with a short drifting echo. */
export function createHallEffect(context, amount = 0) {
  const input = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const output = context.createGain();
  const nodes = [input, dry, wet, output];
  const oscillators = [];
  const voices = [];
  input.connect(dry); dry.connect(output); wet.connect(output);

  // Gains sum to one; no feedback and no audio-rate amplitude modulation.
  for (const [base, depth, frequency, level] of [
    [.022, .006, .63, .38],
    [.035, .008, .89, .38],
    [.145, .012, .27, .24]
  ]) {
    const delay = context.createDelay(.6);
    const voice = context.createGain();
    const modulation = context.createGain();
    const oscillator = context.createOscillator();
    delay.delayTime.value = base;
    voice.gain.value = level;
    modulation.gain.value = depth;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    input.connect(delay); delay.connect(voice); voice.connect(wet);
    oscillator.connect(modulation); modulation.connect(delay.delayTime);
    oscillators.push(oscillator);
    voices.push({ delay, modulation, base, depth });
    nodes.push(delay, voice, modulation, oscillator);
  }
  function applyAmount(value, live = false) {
    const strength = Math.max(0, Math.min(2, value));
    const extra = Math.max(0, strength - 1);
    const mix = .8 * Math.min(1, strength) + .2 * extra;
    const set = (param, value, smoothing = .02) => {
      if (live) param.setTargetAtTime(value, context.currentTime, smoothing);
      else param.value = value;
    };
    set(dry.gain, 1 - mix); set(wet.gain, mix);
    for (const { delay, modulation, base, depth } of voices) {
      set(delay.delayTime, base * (1 + extra), .1);
      set(modulation.gain, depth * (1 + extra), .1);
    }
  }
  applyAmount(amount);
  for (const oscillator of oscillators) oscillator.start();
  let disposed = false;
  return {
    input,
    output,
    setAmount(value) {
      if (disposed) return;
      applyAmount(value, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const oscillator of oscillators) oscillator.stop();
      for (const node of nodes) node.disconnect();
    }
  };
}

/** Saturation adds harmonics; the narrow frequency band gives a tinny radio tone. */
export function distortionCurve(size = 4097) {
  return Float32Array.from({ length: size }, (_, i) => .45 * Math.tanh(12 * (2 * i / (size - 1) - 1)));
}

export function createDistortionEffect(context, amount = 0, levelMatch = new AudioWorkletNode(context, 'distortion-level-match', {
  numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit'
})) {
  const input = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const output = context.createGain();
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass'; highpass.frequency.value = 450; highpass.Q.value = .7;
  const shaper = context.createWaveShaper();
  shaper.curve = distortionCurve(); shaper.oversample = '4x';
  const drive = context.createGain();
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass'; lowpass.frequency.value = 3000; lowpass.Q.value = .7;
  input.connect(dry); dry.connect(output);
  input.connect(highpass); highpass.connect(drive); drive.connect(shaper); shaper.connect(lowpass);
  lowpass.connect(levelMatch, 0, 0);
  input.connect(levelMatch, 0, 1);
  levelMatch.connect(wet); wet.connect(output);
  const strength = Math.max(0, Math.min(1, amount));
  dry.gain.value = 1 - strength; wet.gain.value = strength;
  drive.gain.value = 1 + 3 * Math.max(0, Math.min(2, amount) - 1);
  let disposed = false;
  return {
    input, output,
    setAmount(value) {
      if (disposed) return;
      const strength = Math.max(0, Math.min(1, value));
      dry.gain.setTargetAtTime(1 - strength, context.currentTime, .02);
      wet.gain.setTargetAtTime(strength, context.currentTime, .02);
      drive.gain.setTargetAtTime(1 + 3 * Math.max(0, Math.min(2, value) - 1), context.currentTime, .02);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const node of [input, dry, wet, output, highpass, shaper, drive, lowpass, levelMatch]) node.disconnect();
      levelMatch.port?.close();
    }
  };
}
