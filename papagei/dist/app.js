import { createVoiceRing } from './ring.js?v=805f66bff1c6';
import { raisePitch } from './pitch.js';
import { createHallEffect, createDistortionEffect } from './effects.js';
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
const status = document.querySelector('#status'), hint = document.querySelector('#hint');
let session = 0, context, stream, capture, source, playback, state = 'idle';
let hallEffect, distortionEffect, tailTimer, lastRecording;
const replay = document.querySelector('#replay');
const ringElement = document.querySelector('#voice-ring');
const ring = createVoiceRing(ringElement);
let playbackAnalyser;
const defaults = { speed: .8, pitch: 4, hall: 0, distortion: 0 };
const controls = Object.fromEntries(Object.entries(defaults).map(([id, value]) =>
  [id, document.getElementById(id) ?? { value }]));
function updateControls() {
  for (const [id, control] of Object.entries(controls)) {
    const value = Number(control.value);
    const label = id === 'speed' ? `${value.toFixed(2).replace('.', ',')}×`
      : id === 'pitch' ? `${value > 0 ? '+' : ''}${value} Halbtöne`
      : value === 0 ? 'Aus' : `${value} %`;
    const output = document.getElementById(`${id}-value`);
    if (output) output.textContent = label;
    control.setAttribute?.('aria-valuetext', label);
  }
  hallEffect?.setAmount(Number(controls.hall.value) / 100);
  distortionEffect?.setAmount(Number(controls.distortion.value) / 100);
}
for (const control of Object.values(controls)) control.addEventListener?.('input', updateControls);
updateControls();
function disposeEffects() {
  clearTimeout(tailTimer);
  hallEffect?.dispose(); hallEffect = null;
  distortionEffect?.dispose(); distortionEffect = null;
  playbackAnalyser?.disconnect(); playbackAnalyser = null; ring.setAnalyser(null);
}
let frames = [], preRoll = [], speaking = false, silence = 0, voiced = 0, duration = 0, cooldown = 0;
function show(next, text, detail) {
  state = next; document.body.dataset.state = next; status.textContent = text;
  ring.setState(next);
  if (detail) hint.textContent = detail;
}
function resetPhrase() { frames = []; preRoll = []; speaking = false; silence = voiced = duration = 0; }
function cleanup() {
  ring.reset();
  session++; if (playback) { playback.onended = null; try { playback.stop(); } catch {} playback = null; }
  disposeEffects(); lastRecording = null; if (replay) replay.disabled = true;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  if (capture) { capture.port.onmessage = null; capture.disconnect(); capture = null; }
  source?.disconnect(); source = null;
  context?.close().catch(() => {}); context = null; resetPhrase();
  start.disabled = false; stop.disabled = true;
}
function repeat() {
  if (voiced < .18) { resetPhrase(); return; }
  const samples = frames.reduce((sum, frame) => sum + frame.length, 0);
  lastRecording = new Float32Array(samples);
  let offset = 0; for (const frame of frames) { lastRecording.set(frame, offset); offset += frame.length; }
  playRecording();
}
function playRecording(isReplay = false) {
  const mode = document.querySelector('#playback-mode')?.value ?? 'production';
  if (mode === 'production' || (mode === 'random-replay' && isReplay)) {
    const integer = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    controls.speed.value = (integer(15, 18) / 20).toFixed(2);
    controls.pitch.value = integer(12, 16);
    controls.hall.value = integer(20, 40);
    controls.distortion.value = integer(10, 30);
    updateControls();
  }
  resetPhrase(); if (replay) replay.disabled = true;
  const speed = Number(controls.speed.value);
  // Compensate playback-rate pitch so the pitch slider specifies the total shift.
  const shift = Number(controls.pitch.value) - 12 * Math.log2(speed);
  const processed = Math.abs(shift) < .001 ? lastRecording : raisePitch(lastRecording, context.sampleRate, shift);
  const buffer = context.createBuffer(1, processed.length, context.sampleRate);
  buffer.copyToChannel(processed, 0);
  show('playing', 'Jetzt bin ich dran!', replay ? 'Hall und Verzerrung kannst du direkt beim Hören verändern.' : 'Hör mal, so klingt deine Papageienstimme.');
  playback = context.createBufferSource(); playback.buffer = buffer;
  const begins = context.currentTime + .02;
  playback.playbackRate.value = speed;
  distortionEffect = createDistortionEffect(context, Number(controls.distortion.value) / 100);
  hallEffect = createHallEffect(context, Number(controls.hall.value) / 100);
  playback.connect(distortionEffect.input);
  distortionEffect.output.connect(hallEffect.input);
  if (ringElement) {
    playbackAnalyser = context.createAnalyser(); playbackAnalyser.fftSize = 1024;
    hallEffect.output.connect(playbackAnalyser); playbackAnalyser.connect(context.destination);
    ring.setAnalyser(playbackAnalyser);
  } else hallEffect.output.connect(context.destination);
  const current = session;
  playback.onended = () => {
    if (current !== session) return;
    playback.disconnect(); playback = null;
    tailTimer = setTimeout(() => {
      if (current !== session) return;
      disposeEffects(); cooldown = context.currentTime + .2; if (replay) replay.disabled = false;
      show('listening', 'Ich höre zu …', replay ? 'Sag etwas Neues oder hör denselben Satz noch einmal.' : 'Sag etwas und mach danach eine kurze Pause.');
    }, 400);
  };
  playback.start(begins);
}
replay?.addEventListener('click', () => {
  if (state !== 'listening' || !context || !lastRecording) return;
  playRecording(true);
});
function receive(event) {
  if (state !== 'listening' || context.currentTime < cooldown) return;
  const data = event.data, seconds = data.length / context.sampleRate;
  let energy = 0; for (const value of data) energy += value * value;
  ring.setInputLevel(Math.sqrt(energy / data.length));
  const loud = Math.sqrt(energy / data.length) > .018;
  if (!speaking) {
    preRoll.push(data); if (preRoll.length > 6) preRoll.shift();
    if (!loud) return;
    speaking = true; frames = preRoll; preRoll = [];
  } else frames.push(data);
  duration += seconds;
  if (loud) { silence = 0; voiced += seconds; } else silence += seconds;
  if (silence >= .9 || duration >= 20) repeat();
}
start.addEventListener('click', async () => {
  cleanup(); const current = session; start.disabled = true; stop.disabled = false;
  show('starting', 'Mikrofon wird gestartet …', 'Erlaube den Mikrofonzugriff, dann kann’s losgehen.');
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('unsupported');
    context = new AudioContext(); const activeContext = context;
    await activeContext.resume();
    const acquired = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    if (current !== session) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    await activeContext.audioWorklet.addModule(new URL('./capture.js', import.meta.url)); if (current !== session) return;
    await activeContext.audioWorklet.addModule(new URL('./level-match.js', import.meta.url)); if (current !== session) return;
    source = activeContext.createMediaStreamSource(stream); capture = new AudioWorkletNode(activeContext, 'capture');
    capture.port.onmessage = receive; source.connect(capture); capture.connect(activeContext.destination);
    stream.getAudioTracks()[0].onended = () => { if(current === session){ cleanup(); show('idle','Mikrofon getrennt.','Verbinde dein Mikrofon und drück erneut auf Start.'); } };
    cooldown = 0; show('listening', 'Ich höre zu …', 'Sag etwas und mach danach eine kurze Pause.');
  } catch (error) {
    if (current !== session) return;
    cleanup(); show('idle', 'Das Mikrofon fehlt noch.', error.name === 'NotAllowedError' ? 'Bitte erlaube den Mikrofonzugriff im Browser und starte erneut.' : error.name === 'NotFoundError' ? 'Verbinde ein Mikrofon und starte erneut.' : 'Bitte öffne die Seite über HTTPS oder localhost in einem aktuellen Browser.');
  }
});
stop.addEventListener('click', () => { cleanup(); show('idle', 'Pause. Bis gleich!', 'Drück auf Start, wenn du wieder plappern möchtest.'); });
window.addEventListener('pagehide', cleanup);
