// Measures audio without routing the microphone to the speakers.
export function createVoiceRing(element) {
  if (!element) return { setState() {}, setInputLevel() {}, setAnalyser() {}, reset() {} };
  const paths = [...element.querySelectorAll('path')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', inputLevel = 0, inputAt = 0, analyser = null, samples;
  let level = 0, frame = 0, previousTime = 0;
  function draw(now) {
    const dt = Math.min(.1, (now - previousTime) / 1000 || .016);
    previousTime = now;
    let rms = 0;
    if (state === 'playing' && analyser) {
      analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) rms += sample * sample;
      rms = Math.sqrt(rms / samples.length);
    } else if (state === 'listening' && now - inputAt < 200) rms = inputLevel;
    const target = Math.min(1, Math.sqrt(Math.max(0, rms - .003) * 8));
    // Fast attack and slower release keep the response fluid.
    level += (target - level) * (1 - Math.exp(-dt / (target > level ? .045 : .24)));
    const time = reducedMotion.matches ? 0 : now / 1000;
    const energy = reducedMotion.matches ? 0 : level;
    // A visible five-second breath at rest; speech takes over as energy rises.
    const breath = Math.sin(time * (2 * Math.PI / 5));
    const breathDepth = 11 * (1 - energy) + 2 * energy;
    const radius = 88 + energy * 52 + breath * breathDepth;
    for (let layer = 0; layer < paths.length; layer++) {
      let d = '';
      for (let i = 0; i < 180; i++) {
        const angle = i / 180 * Math.PI * 2;
        const wave = Math.sin(angle * 3 + time * 1.25 + layer * .3) * .5
          + Math.sin(angle * 5 - time * 1.65) * .3 + Math.sin(angle * 8 + time * .95) * .2;
        const r = radius + layer * 7 + wave * (4 + energy * 28);
        d += `${i ? 'L' : 'M'}${(160 + Math.cos(angle) * r).toFixed(2)},${(160 + Math.sin(angle) * r).toFixed(2)}`;
      }
      paths[layer].setAttribute('d', d + 'Z');
    }
    frame = requestAnimationFrame(draw);
  }
  function resume() {
    cancelAnimationFrame(frame); previousTime = 0;
    if (!document.hidden) frame = requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', resume);
  resume();
  return {
    setState(value) { state = value; },
    setInputLevel(value) { inputLevel = value; inputAt = performance.now(); },
    setAnalyser(value) { analyser = value; samples = value ? new Float32Array(value.fftSize) : null; },
    reset() { analyser = null; samples = null; inputLevel = 0; level = 0; state = 'idle'; }
  };
}
