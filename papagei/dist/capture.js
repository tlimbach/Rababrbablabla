class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.parts = []; this.length = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      this.parts.push(channel.slice()); this.length += channel.length;
      if (this.length >= 2048) {
        const samples = new Float32Array(this.length); let offset = 0;
        for (const part of this.parts) { samples.set(part, offset); offset += part.length; }
        this.port.postMessage(samples, [samples.buffer]); this.parts = []; this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture', Capture);
