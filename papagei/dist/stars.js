const canvas = document.querySelector('#starfield');
const ctx = canvas?.getContext('2d');

if (ctx) {
  let width = 0, height = 0, stars = [], frame = 0, last = 0;
  const random = (min, max) => min + Math.random() * (max - min);
  function makeStar(scatteredAge = false) {
    const size = Math.random();
    const color = Math.random();
    const changing = Math.random() < .3;
    const life = changing ? random(2.5, 7) : random(16, 40);
    return {
      x: Math.random(), y: Math.random(),
      depth: .55 + size * 1.45,
      radius: size < .86 ? random(.35, .85) : size < .98 ? random(.9, 1.4) : random(1.5, 2.1),
      color: color < .1 ? '194,174,232' : color < .4 ? '151,160,175' : '235,240,249',
      brightness: changing ? random(.65, 1) : random(.25, .7), life,
      fadeIn: changing ? random(.12, .35) : random(1, 2),
      fadeOut: changing ? random(.08, .2) : random(.4, .8),
      age: scatteredAge ? random(0, life) : 0,
      phase: random(0, Math.PI * 2)
    };
  }
  function paint(dt) {
    ctx.clearRect(0, 0, width, height);
    stars.forEach((star, i) => {
      star.age += dt;
      if (star.age >= star.life) star = stars[i] = makeStar();
      if (dt > 0 && width > 0 && height > 0) {
        // Shared rotation plus a diagonal drift; nearer stars move faster.
        const px = star.x * width, py = star.y * height;
        // A gentle coherent orbit, with a little drift.
        const angle = .027 * dt;
        const cosine = Math.cos(angle), sine = Math.sin(angle);
        const relativeX = px - width / 2, relativeY = py - height / 2;
        const dx = relativeX * cosine - relativeY * sine - relativeX + 4 * star.depth * dt;
        const dy = relativeX * sine + relativeY * cosine - relativeY + 1.5 * star.depth * dt;
        // Wrap just beyond the viewport, so no empty edge opens up.
        const margin = 16;
        const wrap = (value, span) => ((value + margin) % (span + 2 * margin)
          + span + 2 * margin) % (span + 2 * margin) - margin;
        star.x = wrap(px + dx, width) / width;
        star.y = wrap(py + dy, height) / height;
      }
      // Most of the lifetime is clearly visible; short transitions make turnover noticeable.
      const fade = Math.max(0, Math.min(1,
        star.age / star.fadeIn, (star.life - star.age) / star.fadeOut));
      const shimmer = .9 + .1 * Math.sin(star.age * .7 + star.phase);
      const alpha = star.brightness * fade * shimmer;
      const x = star.x * width, y = star.y * height;
      if (star.radius > 1.2) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 5);
        glow.addColorStop(0, `rgba(${star.color},${alpha * .28})`);
        glow.addColorStop(1, `rgba(${star.color},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, star.radius * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${star.color},${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, star.radius, 0, Math.PI * 2); ctx.fill();
    });
  }
  function tick(now) {
    // A quiet background needs only 30 frames per second.
    if (!last || now - last >= 32) {
      paint(last ? Math.min((now - last) / 1000, .1) : 0);
      last = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(frame); last = 0;
    if (document.hidden) return;
    paint(0);
    frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = 20 * Math.min(360, Math.max(65, Math.round(width * height / 5500)));
    while (stars.length < count) stars.push(makeStar(true));
    stars.length = count;
    paint(0);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', resume);
  resize(); resume();
}
