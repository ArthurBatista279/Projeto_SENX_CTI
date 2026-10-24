/* Sessão por cookie HttpOnly; nenhum token ou senha é salvo pela aplicação no navegador. */
window.SenxSession = (() => {
  async function fetchJson(path, options={}) {
    const response=await fetch(path,{...options,credentials:'same-origin',signal:AbortSignal.timeout(15000)});
    const text=await response.text();
    let body;
    try { body=text?JSON.parse(text):{}; } catch { throw new Error('Resposta inválida da API. Confira o servidor local.'); }
    if(!response.ok) {
      const message=body.detail || body.title || (response.status===401?'Entre com sua conta para continuar.':response.status===403?'Acesso não permitido.':response.status===429?'Muitas tentativas. Aguarde um minuto e tente novamente.':'Falha HTTP '+response.status);
      if(response.status===401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('senx-session-expired'));
      throw Object.assign(new Error(message),{status:response.status,body});
    }
    return body;
  }
  async function request(path, options={}) {
    if(location.protocol==='file:') throw new Error('Abra a SENX ou o diagnóstico pelo endereço local.');
    try {
      if(options.method && !['GET','HEAD'].includes(options.method.toUpperCase())) {
        const csrf=await fetchJson('/api/auth/csrf');
        options={...options,headers:{...options.headers,'X-CSRF-Token':csrf.token}};
      }
      return await fetchJson(path,options);
    } catch(error) {
      if(error.name==='TimeoutError' || error.name==='AbortError') throw new Error('A API excedeu o tempo de resposta. Tente novamente.');
      if(error instanceof TypeError) throw new Error('API local indisponível. Inicie o backend na porta 5080.');
      throw error;
    }
  }
  return {request};
})();
