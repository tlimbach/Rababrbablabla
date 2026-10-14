import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../dist/ring.js', import.meta.url), 'utf8');

function setup(reducedMotion) {
  const node = () => ({
    style: {}, attributes: {}, children: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    appendChild(child) { this.children.push(child); child.parentNode = this; }
  });
  const svg = node(), tail = node();
  const paths = [node(), node(), node()];
  paths.forEach(path => svg.appendChild(path));
  const element = { querySelectorAll: () => paths, querySelector: () => tail };
  let draw, now = 0;
  const create = runInNewContext(source.replace('export function', 'function') + '\ncreateVoiceRing;', {
    document: { createElementNS: node, addEventListener() {}, hidden: false },
    window: { addEventListener() {} },
    matchMedia: () => ({ matches: reducedMotion }),
    performance: { now: () => now },
    requestAnimationFrame(callback) { draw = callback; return 1; },
    cancelAnimationFrame() {}
  });
  const ring = create(element);
  return {
    ring, head: paths[0], highlight: svg.children.at(-1), tail,
    step(level, frames = 60) {
      for (let i = 0; i < frames; i++) {
        now += 16;
        if (level !== undefined) ring.setInputLevel(level);
        draw(now);
      }
    }
  };
}

for (const reduced of [false, true]) {
  test(`head brightens with speech and fades without new audio (reduced motion: ${reduced})`, () => {
    const scene = setup(reduced);
    scene.ring.setState('listening');
    scene.step(0);
    const quietShape = scene.head.getAttribute('d');
    assert.equal(Number(scene.highlight.style.opacity), 0);
    scene.step(.025);
    const speechOpacity = Number(scene.highlight.style.opacity);
    assert.ok(speechOpacity > .3, 'moderate microphone levels remain visible');
    scene.step(.12);
    assert.ok(Number(scene.highlight.style.opacity) > speechOpacity);
    assert.ok(Number(scene.highlight.style.opacity) > .85);
    assert.equal(scene.highlight.getAttribute('d'), scene.head.getAttribute('d'));
    assert.equal(scene.highlight.getAttribute('vector-effect'), 'non-scaling-stroke');
    assert.notEqual(scene.head.getAttribute('d'), quietShape);
    scene.step(undefined, 120);
    assert.ok(Number(scene.highlight.style.opacity) < .01);
    assert.equal(scene.tail.children.length, 36);
  });
}
