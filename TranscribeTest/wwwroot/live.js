const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.ratio = sampleRate / 16000;
    this.pos = 0; this.acc = 0; this.count = 0; this.out = []; this.stopped = false;
    this.port.onmessage = e => {
      if (e.data === 'flush') {
        this.stopped = true; this.flush(); this.port.postMessage({ flushed: true });
      }
    };
  }
  flush() {
    if (!this.out.length) return;
    const pcm = new Int16Array(this.out.length);
    for (let j = 0; j < pcm.length; j++) {
      const s = Math.max(-1, Math.min(1, this.out[j]));
      pcm[j] = s < 0 ? s * 32768 : s * 32767;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]); this.out = [];
  }
  process(inputs) {
    if (this.stopped) return true;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (const sample of ch) {
      this.acc += sample; this.count++; this.pos++;
      if (this.pos >= this.ratio) {
        this.out.push(this.acc / this.count);
        this.pos -= this.ratio; this.acc = 0; this.count = 0;
        if (this.out.length >= 1600) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

let liveSession = null;
function liveStatus(text, error = false) {
  $('l-status').textContent = text;
  $('l-status').className = 'status' + (error ? ' err' : '');
}

function makeWav(chunks, bytes) {
  const header = new ArrayBuffer(44), v = new DataView(header);
  const write = (offset, text) => [...text].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF'); v.setUint32(4, bytes + 36, true); write(8, 'WAVE'); write(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  write(36, 'data'); v.setUint32(40, bytes, true);
  return new Blob([header, ...chunks], { type: 'audio/wav' });
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || ('HTTP ' + response.status));
  return data;
}

// Somente uma requisição por sessão: uma resposta antiga nunca sobrescreve a última gravação.
async function updateRecording(s, final = false) {
  if (s.pending) {
    if (!final) return;
    await s.pending;
  }
  if (!s.bytes || (!final && s.savedBytes === s.bytes && !s.backup)) return;
  const bytes = s.bytes;
  const form = new FormData();
  form.append('file', makeWav(s.chunks.slice(), bytes), 'microfone.wav');
  const useBackup = s.backup && !s.saveOnly;
  s.pending = (async () => {
    try {
      let response;
      if (useBackup) {
        const query = new URLSearchParams({ ...s.settings, provider: s.preferred,
          backupOnly: 'true', recordingId: s.recording.id });
        response = await fetch('/api/transcribe?' + query, { method: 'POST', body: form });
      } else {
        response = await fetch('/api/recordings/' + s.recording.id, { method: 'PUT', body: form });
      }
      // Mesmo no erro de transcrição, o servidor pode ter persistido o áudio.
      const data = await response.json().catch(() => ({}));
      if (data.recording) { showRecording('l-recording', data.recording); s.savedBytes = bytes; }
      if (!response.ok) throw new Error(data.detail || ('HTTP ' + response.status));
      s.savedBytes = bytes;
      s.lastError = null;
      if (useBackup) {
        // A reserva recebe a sessão completa; substituímos o texto para evitar duplicação na troca.
        $('l-final').textContent = data.text || '';
        $('l-interim').textContent = '';
        $('l-provider').textContent = 'IA utilizada: ' + (data.providerLabel || data.provider) + ' (atualização por intervalos). ' + (data.notices || []).join(' ');
        s.preferred = data.provider;
        liveStatus(s.stopping ? 'Finalizando gravação…' : 'Gravando e transcrevendo com ' + (data.providerLabel || data.provider) + '…');
      } else showRecording('l-recording', data);
    } catch (error) {
      s.lastError = error.message;
      liveStatus('Erro: ' + error.message + (s.stopping ? '' : ' Nova tentativa no próximo intervalo.'), true);
    }
  })();
  try { await s.pending; } finally { s.pending = null; }
}

function activateBackup(s, reason) {
  if (s.backup || liveSession !== s) return;
  s.backup = true;
  clearTimeout(s.connectTimer);
  if (s.socket) { s.socket.onclose = null; s.socket.close(); s.socket = null; }
  s.finishTurn?.();
  if (!s.config.backupAvailable) {
    s.lastError = reason + ' Configure uma chave de IA reserva no appsettings.json.';
    liveStatus(s.lastError + ' A gravação continuará sendo salva.', true);
    // Sem reservas, manter apenas a persistência, sem disparar chamadas inúteis.
    s.saveOnly = true;
  } else {
    $('l-provider').textContent = 'Trocando para outra IA configurada…';
    liveStatus(reason + ' Recuperando o áudio com uma IA reserva…');
  }
  if (!s.stopping) void tickUpdate(s);
}

async function tickUpdate(s, final = false) {
  await updateRecording(s, final);
}

function connectGemini(s) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = s.socket = new WebSocket(`${proto}://${location.host}/ws/transcribe?${new URLSearchParams(s.settings)}`);
  socket.binaryType = 'arraybuffer';
  s.connectTimer = setTimeout(() => activateBackup(s, 'Gemini demorou para conectar.'),
    (s.config.liveConnectTimeoutSeconds + 2) * 1000);
  socket.onmessage = e => {
    if (s.backup || liveSession !== s) return;
    let message;
    try { message = JSON.parse(e.data); } catch { return; }
    if (message.type === 'ready') {
      clearTimeout(s.connectTimer); s.ready = true;
      $('l-provider').textContent = 'IA utilizada: Gemini (streaming).';
      for (const chunk of s.chunks) socket.send(chunk);
      if (s.stopping) socket.send('end');
    } else if (message.type === 'interim' || message.type === 'final') {
      s.lastResponse = Date.now();
      if (message.type === 'interim') $('l-interim').textContent = message.text || '';
      else {
        $('l-final').textContent += (message.text || '') + ' ';
        $('l-interim').textContent = ''; s.pendingSpeech = 0;
        s.finishTurn?.();
      }
    } else if (message.type === 'error') activateBackup(s, message.text || 'Gemini indisponível.');
  };
  socket.onerror = () => activateBackup(s, 'Falha na conexão com Gemini.');
  socket.onclose = () => activateBackup(s, 'A sessão Gemini foi encerrada.');
}

$('l-go').onclick = () => liveSession ? stopRecording(liveSession) : startRecording();

async function startRecording() {
  if (liveBusy) return;
  liveBusy = true; updateProviderControls(); $('l-go').disabled = true;
  const s = { chunks: [], bytes: 0, savedBytes: 0, pendingSpeech: 0, lastResponse: Date.now(),
    startedAt: Date.now(), preferred: $('provider-select').value, stopping: false };
  liveSession = s;
  try {
    s.config = await transcriptionConfig;
    s.settings = { mode: $('l-mode').value.toLowerCase(), lang: $('l-lang').value.trim(), vocab: $('l-vocab').value.trim() };
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    s.recording = await readResponse(await fetch('/api/recordings', { method: 'POST' }));
    showRecording('l-recording', s.recording);
    s.audio = new AudioContext();
    await s.audio.resume();
    const url = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
    try { await s.audio.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    s.source = s.audio.createMediaStreamSource(s.stream);
    s.node = new AudioWorkletNode(s.audio, 'pcm-processor');
    s.node.port.onmessage = e => {
      if (e.data.flushed) { s.flushed?.(); return; }
      const chunk = e.data;
      s.chunks.push(chunk); s.bytes += chunk.byteLength;
      const pcm = new Int16Array(chunk);
      let sum = 0; for (const sample of pcm) sum += sample * sample;
      if (Math.sqrt(sum / pcm.length) > 500 && !s.pendingSpeech) s.pendingSpeech = Date.now();
      if (!s.backup && s.ready && s.socket?.readyState === WebSocket.OPEN) s.socket.send(chunk);
    };
    // Destino mudo mantém o processamento ativo sem reproduzir o microfone.
    s.mute = s.audio.createGain(); s.mute.gain.value = 0;
    s.source.connect(s.node); s.node.connect(s.mute); s.mute.connect(s.audio.destination);
    $('l-final').textContent = ''; $('l-interim').textContent = '';
    $('l-go').innerHTML = '<span class="dot"></span>Parar e salvar';
    $('l-go').classList.add('stop'); $('l-go').disabled = false;
    ['l-mode', 'l-lang', 'l-vocab'].forEach(id => $(id).disabled = true);
    liveStatus('Gravando…');
    const geminiConfigured = s.config.providers.find(p => p.name === 'Gemini')?.configured;
    if ((s.preferred !== 'auto' && s.preferred !== 'Gemini') || !geminiConfigured) {
      s.backup = true;
      s.saveOnly = !s.config.backupAvailable;
      const label = s.config.providers.find(p => p.name === s.preferred)?.label || s.preferred;
      $('l-provider').textContent = s.saveOnly ? 'Nenhuma IA reserva configurada. Salvando somente o áudio.' : 'IA preferida: ' + (s.preferred === 'auto' ? 'Reservas configuradas' : label) + ' — aguardando áudio…';
    } else {
      $('l-provider').textContent = 'Conectando ao Gemini…';
      connectGemini(s);
    }
    s.startedAt = Date.now();
    s.updateTimer = setInterval(() => { if (!s.stopping) void tickUpdate(s); }, s.config.liveRefreshSeconds * 1000);
    s.clockTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
      $('l-timer').textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} / 10:00`;
      if (!s.backup && s.pendingSpeech && Date.now() - Math.max(s.pendingSpeech, s.lastResponse) > s.config.liveResponseTimeoutSeconds * 1000)
        activateBackup(s, 'Gemini demorou para transcrever a fala.');
      if (elapsed >= 600 && !s.stopping) void stopRecording(s);
    }, 500);
  } catch (error) {
    liveStatus('Não foi possível iniciar: ' + error.message, true);
    cleanupRecording(s);
  }
}

async function stopRecording(s) {
  if (s.stopping) return;
  s.stopping = true; $('l-go').disabled = true;
  clearInterval(s.updateTimer); clearInterval(s.clockTimer);
  liveStatus('Salvando gravação e finalizando transcrição…');
  try {
    if (s.node) {
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 1000);
        s.flushed = () => { clearTimeout(timeout); resolve(); };
        s.node.port.postMessage('flush');
      });
    }
    s.source?.disconnect(); s.node?.disconnect();
    s.stream?.getTracks().forEach(track => track.stop());
    // Persistir antes de aguardar a última resposta da IA.
    if (!s.backup) await updateRecording(s, true);
    if (!s.backup && s.pendingSpeech) {
      await new Promise(resolve => {
        const timeout = setTimeout(() => { activateBackup(s, 'Gemini não finalizou a transcrição no prazo.'); resolve(); },
          s.config.liveResponseTimeoutSeconds * 1000);
        s.finishTurn = () => { clearTimeout(timeout); resolve(); };
        if (s.socket?.readyState === WebSocket.OPEN) s.socket.send('end');
      });
    } else if (!s.backup && s.socket?.readyState === WebSocket.OPEN) s.socket.send('end');
    if (s.backup) await tickUpdate(s, true);
    if (!s.lastError && !s.saveOnly) liveStatus('Sessão encerrada. Gravação salva.');
    else liveStatus((s.savedBytes === s.bytes ? 'Gravação salva. ' : 'Não foi possível salvar todo o áudio. ') + (s.lastError || 'Transcrição indisponível: configure uma IA reserva.'), true);
    // Permite recuperar o WAV local mesmo se o servidor ficar indisponível durante a gravação.
    if (s.savedBytes !== s.bytes && s.bytes) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(makeWav(s.chunks, s.bytes));
      link.download = 'microfone.wav'; link.textContent = ' Baixar áudio preservado no navegador';
      $('l-recording').appendChild(link);
    }
  } finally { cleanupRecording(s); }
}

function cleanupRecording(s) {
  clearInterval(s.updateTimer); clearInterval(s.clockTimer); clearTimeout(s.connectTimer);
  if (s.socket) { s.socket.onclose = null; s.socket.onerror = null; s.socket.close(); }
  s.source?.disconnect(); s.node?.disconnect(); s.mute?.disconnect();
  s.stream?.getTracks().forEach(track => track.stop());
  if (s.audio) void s.audio.close();
  if (liveSession !== s) return;
  liveSession = null; liveBusy = false; updateProviderControls();
  $('l-go').textContent = '🎙️ Iniciar'; $('l-go').disabled = false; $('l-go').classList.remove('stop');
  ['l-mode', 'l-lang', 'l-vocab'].forEach(id => $(id).disabled = false);
}

window.addEventListener('beforeunload', event => {
  if (!liveBusy) return;
  event.preventDefault(); event.returnValue = '';
});
