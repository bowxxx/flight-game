// Sound: everything is synthesised with WebAudio, no audio files. A low
// engine drone whose pitch follows the throttle, wind rush with speed, and
// short chimes for rings, landings and warnings. Starts on first input.
export function createAudio() {
  const audio = { ctx: null, muted: false, engine: null, wind: null, windGain: null };
  return audio;
}

function ensureContext(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    audio.ctx = ctx;
    // Engine: two detuned saws through a low-pass filter.
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = 82;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc1.start(); osc2.start();
    // Wind: looped filtered noise.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 700;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start();
    audio.engine = { osc1, osc2, filter, gain };
    audio.wind = { noiseFilter, gain: noiseGain };
    return true;
  } catch {
    return false;
  }
}

export function startAudio(audio) { ensureContext(audio); }

export function updateAudio(audio, plane, flying) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const target = flying ? 0.05 + plane.throttle * 0.075 : 0;
  audio.engine.gain.gain.setTargetAtTime(target, t, 0.1);
  audio.engine.osc1.frequency.setTargetAtTime(48 + plane.throttle * 66 + plane.speed * 0.25, t, 0.1);
  audio.engine.osc2.frequency.setTargetAtTime(72 + plane.throttle * 96 + plane.speed * 0.4, t, 0.1);
  audio.engine.filter.frequency.setTargetAtTime(260 + plane.throttle * 700, t, 0.1);
  const windLevel = flying ? Math.min(0.12, plane.speed * 0.0009) : 0;
  audio.wind.gain.gain.setTargetAtTime(windLevel, t, 0.15);
  audio.wind.noiseFilter.frequency.setTargetAtTime(500 + plane.speed * 9, t, 0.15);
}

function blip(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain); gain.connect(audio.ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}

export function playRing(audio) {
  ensureContext(audio);
  blip(audio, 880, 0.18, 'sine', 0.22);
  blip(audio, 1318, 0.28, 'sine', 0.2, 0.09);
}

export function playLanding(audio, perfect) {
  ensureContext(audio);
  blip(audio, 392, 0.3, 'triangle', 0.25);
  blip(audio, 523, 0.3, 'triangle', 0.25, 0.12);
  if (perfect) blip(audio, 784, 0.5, 'sine', 0.22, 0.24);
}

export function playCrash(audio) {
  ensureContext(audio);
  blip(audio, 90, 0.5, 'sawtooth', 0.3);
  blip(audio, 55, 0.7, 'square', 0.2, 0.05);
}

export function playWarning(audio) {
  ensureContext(audio);
  blip(audio, 660, 0.12, 'square', 0.08);
}

export function playClick(audio) {
  ensureContext(audio);
  blip(audio, 520, 0.07, 'sine', 0.12);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.ctx) {
    const t = audio.ctx.currentTime;
    if (audio.engine) audio.engine.gain.gain.setTargetAtTime(0, t, 0.05);
    if (audio.wind) audio.wind.gain.gain.setTargetAtTime(0, t, 0.05);
  }
  return audio.muted;
}
