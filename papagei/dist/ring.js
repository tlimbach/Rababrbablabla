// Measures audio without routing the microphone to the speakers.
export function createVoiceRing(element) {
  if (!element) return { setState() {}, setInputLevel() {}, setAnalyser() {}, reset() {} };
  const paths = [...element.querySelectorAll('svg > path')];
  const tail = element.querySelector('.worm-tail');
  const segments = Array.from({ length: 36 }, () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tail.appendChild(path);
    return path;
  });
  // Sample one continuous route at delayed times, so the tail follows the head.
  const position = time => ({
    x: 400 + 140 * Math.sin(time * .23) + 30 * Math.sin(time * .49 + 1),
    y: 300 + 55 * Math.sin(time * .31 + .7) + 15 * Math.cos(time * .57)
  });
  const contour = (center, radius, time, strength, layer = 0) => {
    let d = '';
    for (let i = 0; i < 120; i++) {
      const angle = i / 120 * Math.PI * 2;
      const wave = Math.sin(angle * 3 + time * 1.25 + layer * .3) * .5
        + Math.sin(angle * 5 - time * 1.65) * .3 + Math.sin(angle * 8 + time * .95) * .2;
      const r = radius + wave * strength;
      d += `${i ? 'L' : 'M'}${(center.x + Math.cos(angle) * r).toFixed(2)},${(center.y + Math.sin(angle) * r).toFixed(2)}`;
    }
    return d + 'Z';
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', inputLevel = 0, inputAt = 0, analyser = null, samples;
  let level = 0, frame = 0, previousTime = 0, elapsed = 0;
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
    if (!reducedMotion.matches) elapsed += dt;
    const time = reducedMotion.matches ? 0 : elapsed;
    const energy = reducedMotion.matches ? 0 : level;
    // A visible five-second breath at rest; speech takes over as energy rises.
    const breath = Math.sin(time * (2 * Math.PI / 5));
    const breathDepth = 11 * (1 - energy) + 2 * energy;
    const radius = (88 + energy * 52 + breath * breathDepth) * .825;
    const headRadius = radius * 1.5;
    const head = position(time);
    // Draw the narrow tip first, then overlapping sections toward the head.
    for (let j = 0; j < segments.length; j++) {
      const fraction = (segments.length - j) / segments.length;
      const lag = fraction * 16;
      const taper = Math.pow(1 - fraction * .97, 1.1);
      const center = position(time - lag);
      const segmentRadius = headRadius * taper;
      segments[j].setAttribute('d', contour(center, segmentRadius, time - lag, (3 + energy * 16) * taper * 2.25));
      segments[j].setAttribute('style', `opacity:${(.4 + .45 * taper).toFixed(3)};stroke-width:${(1.8 + 1.4 * taper).toFixed(2)}`);
    }
    for (let layer = 0; layer < paths.length; layer++) {
      paths[layer].setAttribute('d', contour(head, headRadius + layer * 9, time, (3 + energy * 16) * 2.25, layer));
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
