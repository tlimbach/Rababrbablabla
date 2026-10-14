// Measures audio without routing the microphone to the speakers.
export function createVoiceRing(element) {
  if (!element) return { setState() {}, setInputLevel() {}, setAnalyser() {}, reset() {} };
  const paths = [...element.querySelectorAll('svg > path')];
  // A real white stroke remains visible even when mobile SVG filters are faint.
  // Keep its width in screen pixels as the whole worm shrinks on a phone.
  const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  highlight.setAttribute('class', 'ring-highlight');
  highlight.setAttribute('vector-effect', 'non-scaling-stroke');
  highlight.style.stroke = '#fff';
  highlight.style.fill = 'none';
  highlight.style.opacity = '0';
  paths[0].parentNode.appendChild(highlight);
  const tail = element.querySelector('.worm-tail');
  const segments = Array.from({ length: 36 }, () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tail.appendChild(path);
    return path;
  });
  // The body has its own long spine instead of piling up old head positions.
  const position = time => ({
    x: 500 + 25 * Math.sin(time * .23),
    y: 280 + 18 * Math.sin(time * .31 + .7)
  });
  const spine = (head, fraction, time) => {
    const direction = -.12 + .14 * Math.sin(time * .19);
    const along = fraction * 460;
    const bend = 85 * Math.sin(fraction * Math.PI * 2 - time * .65)
      * Math.sin(fraction * Math.PI);
    return {
      x: head.x - along * Math.cos(direction) - bend * Math.sin(direction),
      y: head.y - along * Math.sin(direction) + bend * Math.cos(direction)
    };
  };
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
    elapsed += dt;
    const time = elapsed;
    const energy = level;
    // Brighten the head with the measured microphone or playback level.
    const glow = level;
    highlight.style.opacity = (glow * .95).toFixed(3);
    highlight.style.strokeWidth = (1 + glow * 2).toFixed(2);
    paths[0].style.filter = `brightness(${(1 + glow * 1.5).toFixed(2)}) drop-shadow(0 0 ${4 + glow * 5}px currentColor) drop-shadow(0 0 ${12 + glow * 18}px currentColor) drop-shadow(0 0 ${24 + glow * 32}px currentColor)`;
    paths[0].style.strokeWidth = (3.2 + glow * 2.8).toFixed(2);

    // A visible five-second breath at rest; speech takes over as energy rises.
    const breath = Math.sin(time * (2 * Math.PI / 5));
    const breathDepth = 11 * (1 - energy) + 2 * energy;
    const radius = (88 + energy * 52 + breath * breathDepth) * .825;
    const headRadius = radius * 2.25;
    const head = position(time);
    // Draw the narrow tip first, then overlapping sections toward the head.
    for (let j = 0; j < segments.length; j++) {
      const fraction = (segments.length - j) / segments.length;
      const lag = fraction * 16;
      const taper = Math.pow(1 - fraction * .97, 1.1);
      const center = spine(head, fraction, time);
      const segmentRadius = headRadius * taper;
      segments[j].setAttribute('d', contour(center, segmentRadius, time - lag, (3 + energy * 16) * taper * 2.25));
      segments[j].setAttribute('style', `opacity:${(.14 + .71 * Math.pow(1 - fraction * fraction, 1.4)).toFixed(3)};stroke-width:${(1.8 + 1.4 * taper).toFixed(2)}`);
    }
    for (let layer = 0; layer < paths.length; layer++) {
      paths[layer].setAttribute('d', contour(head, headRadius + layer * 9, time, (3 + energy * 16) * 2.25, layer));
    }
    highlight.setAttribute('d', paths[0].getAttribute('d'));
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
