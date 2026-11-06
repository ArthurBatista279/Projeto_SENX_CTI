/* Upload pela sessão e proteção CSRF existentes. */
(() => {
  const request = window.SenxSession.request, escape = window.SenxCore.escapeHtml;
  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-action="upload-audio"]');
    if (!trigger || trigger.disabled) return;
    trigger.disabled = true;
    try {
      const options = await request('/api/ligacoes/upload-options');
      const dialog = document.createElement('dialog');
      const select = (name, label, rows, extra = '') => '<label class="form-field"><span>' + label + extra + '</span><select name="' + name + '" required>' + (rows.length ? rows.map(r => '<option value="' + escape(r.id) + '" data-phone="' + escape(r.phone || '') + '">' + escape(r.name) + (r.phone ? ' (' + escape(r.phone) + ')' : '') + '</option>').join('') : '<option value="">Nenhum cliente cadastrado</option>') + '</select></label>';
      dialog.innerHTML = '<form class="upload-form"><div class="modal-head"><h2>Enviar gravação</h2></div><div class="modal-body"><label class="upload-drop form-field">Selecione ou arraste um áudio WAV, MP3, OGG ou M4A (até 20 MB)<input type="file" name="audio" accept=".wav,.mp3,.ogg,.m4a" required></label><div class="form-grid">' + select('IdFuncionario', 'Atendente', options.users) + select('IdCliente', 'Cliente', options.customers) + '<label class="form-field">Número de origem<input name="NumeroOrigem" maxlength="11" pattern="[0-9]{1,11}" required></label><label class="form-field">Número de destino<input name="NumeroDestino" maxlength="11" pattern="[0-9]{1,11}" required></label><label class="form-field">Direção<select name="Direcao"><option>Entrada</option><option>Saída</option></select></label></div><p>O áudio será enviado ao provedor de IA configurado. Sem chave, o resultado será uma demonstração identificada como simulada.</p><p class="form-error" role="alert"></p><p class="upload-status" role="status" aria-live="polite"></p><progress hidden aria-label="Processamento do áudio"></progress></div><div class="modal-footer"><button type="button" class="btn secondary upload-close" aria-label="Fechar">Cancelar</button><button class="btn" type="submit">Processar Áudio com IA</button></div></form>';
      document.body.append(dialog);
      let processing = false;
      dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); });
      dialog.addEventListener('cancel', e => { if (processing) e.preventDefault(); });
      dialog.querySelector('.upload-close').onclick = () => { if (!processing) dialog.close(); };
      const customerSelect = dialog.querySelector('select[name="IdCliente"]');
      const originInput = dialog.querySelector('input[name="NumeroOrigem"]');
      const destinationInput = dialog.querySelector('input[name="NumeroDestino"]');
      const directionSelect = dialog.querySelector('select[name="Direcao"]');
      const automatic = new Map();
      function syncCustomerPhone() {
        for (const [input, value] of automatic) {
          if (input.value === value) input.value = '';
        }
        automatic.clear();
        const phone = (customerSelect.selectedOptions[0]?.dataset.phone || '').replace(/\D/g, '');
        const target = directionSelect.value === 'Entrada' ? originInput : destinationInput;
        if (phone && !target.value) {
          target.value = phone;
          automatic.set(target, phone);
        }
      }
      [originInput, destinationInput].forEach(input => {
        input.addEventListener('input', () => automatic.delete(input));
      });
      customerSelect.addEventListener('change', syncCustomerPhone);
      directionSelect.addEventListener('change', syncCustomerPhone);
      syncCustomerPhone();
      const fileInput = dialog.querySelector('[type=file]'), drop = dialog.querySelector('.upload-drop');
      drop.addEventListener('dragover', e => e.preventDefault());
      drop.addEventListener('drop', e => { e.preventDefault(); if (!processing && e.dataTransfer.files.length === 1) fileInput.files = e.dataTransfer.files; });
      const form = dialog.querySelector('form');
      form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (processing || !form.reportValidity()) return;
        const error = form.querySelector('.form-error'), status = form.querySelector('.upload-status');
        error.textContent = '';
        const file = fileInput.files[0];
        if (!file || file.size > 20 * 1024 * 1024 || !/\.(wav|mp3|ogg|m4a)$/i.test(file.name)) { error.textContent = 'Selecione um áudio permitido de até 20 MB.'; return; }
        const body = new FormData(form);
        processing = true;
        form.querySelectorAll('button,input,select').forEach(c => c.disabled = true);
        form.querySelector('progress').hidden = false;
        status.textContent = 'Enviando e analisando o áudio. Aguarde a conclusão.';
        try {
          const result = await request('/api/ligacoes/upload', { method: 'POST', body, signal: AbortSignal.timeout(600000) });
          window.dispatchEvent(new CustomEvent('senx-upload-completed', { detail: result }));
          status.textContent = result.simulated ? 'Demonstração simulada concluída. Não representa o conteúdo do áudio.' : 'Análise concluída. Revise o resultado na lista de ligações.';
          form.querySelector('.upload-close').disabled = false;
        } catch (e) {
          error.textContent = e.message;
          status.textContent = 'Processamento não confirmado. Atualize a lista antes de reenviar.';
          form.querySelectorAll('button,input,select').forEach(c => c.disabled = false);
        } finally { processing = false; form.querySelector('progress').hidden = true; }
      });
      dialog.showModal();
    } catch (error) {
      const toast = document.querySelector('#toast');
      if (toast) { toast.textContent = error.message; toast.classList.add('visible'); }
    } finally { trigger.disabled = false; }
  });
})();
