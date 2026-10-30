const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { value: id === 'provider-select' ? 'auto' : id === 'l-mode' ? 'SMART' : '',
    textContent: '', classList: { add() {}, remove() {} }, appendChild() {} });
  return elements.get(id);
};
const requests = [];
const intervals = [];
class Socket {
  static OPEN = 1;
  constructor() { this.readyState = 1; this.sent = []; }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; }
}
class Node {
  constructor() { this.port = { postMessage: () => queueMicrotask(() => this.port.onmessage({ data: { flushed: true } })) }; }
  connect() {} disconnect() {}
}
class Audio {
  constructor() { this.audioWorklet = { addModule: async () => {} }; this.destination = {}; }
  async resume() {} async close() {}
  createMediaStreamSource() { return new Node(); }
  createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
}
const config = { backupAvailable: true, liveConnectTimeoutSeconds: 10, liveResponseTimeoutSeconds: 15,
  liveRefreshSeconds: 8, providers: [{ name: 'Gemini', configured: true }] };
const ctx = vm.createContext({ $, Blob, FormData, ArrayBuffer, DataView, Int16Array,
  URLSearchParams, URL, Date, console, setTimeout, clearTimeout,
  setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
  WebSocket: Socket, AudioContext: Audio, AudioWorkletNode: Node,
  liveBusy: false, updateProviderControls() {}, transcriptionConfig: Promise.resolve(config),
  showRecording() {}, location: { protocol: 'http:', host: 'localhost' },
  window: { addEventListener() {} }, document: { createElement: () => ({}) },
  navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } },
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (url === '/api/recordings') return response({ id: 'session', folder: 'test' });
    if (url.startsWith('/api/transcribe')) return response({ text: 'Texto recuperado completo', provider: 'Deepgram',
      notices: [], recording: { id: 'session', folder: 'test', fileName: 'audio.wav' } });
    return response({ id: 'session', folder: 'test', fileName: 'audio.wav' });
  }
});
function $(id) { return element(id); }
function response(value) { return { ok: true, json: async () => value }; }
const code = fs.readFileSync(path.join(__dirname, '../wwwroot/live.js'), 'utf8');
vm.runInContext(code + '\nglobalThis.api = { startRecording, stopRecording, activateBackup, updateRecording, makeWav, getSession: () => liveSession, workletCode };', ctx);
(async () => {
  await ctx.api.startRecording();
  const s = ctx.api.getSession();
  const audio = new Int16Array([1000, -1000, 2000, -2000]).buffer;
  s.node.port.onmessage({ data: audio });
  assert.equal(s.bytes, 8);
  assert.equal(s.socket.sent.length, 0, 'aguarda setupComplete');
  s.socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  assert.equal(s.socket.sent.length, 1, 'reenvia áudio acumulado durante conexão');
  await ctx.api.updateRecording(s);
  const save = requests.find(r => r.options.method === 'PUT');
  const wav = Buffer.from(await save.options.body.get('file').arrayBuffer());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(40), 8);
  assert.equal(wav.length, 52);
  assert.equal(wav.readInt16LE(44), 1000);
  console.log('PASS microfone acumula PCM, aguarda Gemini pronto e salva WAV íntegro');
  $('l-final').textContent = 'Texto parcial antigo';
  ctx.api.activateBackup(s, 'quota');
  if (s.pending) await s.pending;
  assert.equal($('l-final').textContent, 'Texto recuperado completo');
  assert.match($('l-provider').textContent, /Deepgram/);
  assert(requests.some(r => r.url.includes('backupOnly=true') && r.url.includes('recordingId=session')));
  s.node.port.onmessage({ data: audio });
  await ctx.api.stopRecording(s);
  assert.equal(s.savedBytes, 16);
  assert.equal(ctx.api.getSession(), null);
  assert.equal($('l-go').disabled, false);
  console.log('PASS fallback recupera sessão sem duplicar texto e salva versão final');

  $('provider-select').value = 'NvidiaParakeet';
  config.providers.push({ name: 'NvidiaParakeet', label: 'NVIDIA Parakeet multilíngue', configured: true });
  await ctx.api.startRecording();
  const nvidia = ctx.api.getSession();
  assert.equal(nvidia.backup, true);
  assert.equal(nvidia.socket, undefined, 'selecionar NVIDIA não abre Gemini');
  nvidia.node.port.onmessage({ data: audio });
  await ctx.api.stopRecording(nvidia);
  assert(requests.some(r => r.url.includes('provider=NvidiaParakeet')), 'preferência NVIDIA enviada ao backend');
  console.log('PASS seleção NVIDIA usa snapshots e preserva salvamento');

  let Processor;
  const worklet = vm.createContext({ sampleRate: 48000, Int16Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage() {} }; } },
    registerProcessor: (_, type) => { Processor = type; } });
  vm.runInContext(ctx.api.workletCode, worklet);
  const processor = new Processor(), output = [];
  processor.port.postMessage = data => output.push(data);
  processor.process([[new Float32Array(480).fill(.5)]]);
  assert.equal(output.length, 0);
  processor.port.onmessage({ data: 'flush' });
  assert.equal(output[0].byteLength, 320, 'descarrega as 160 amostras pendentes');
  assert.equal(output[1].flushed, true);
  console.log('PASS parar descarrega o bloco incompleto de áudio');

  // Verificar também a sintaxe da interface principal.
  const html = fs.readFileSync(path.join(__dirname, '../wwwroot/index.html'), 'utf8');
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  console.log('5 verificações frontend passaram.');
})().catch(error => { console.error(error); process.exitCode = 1; });
