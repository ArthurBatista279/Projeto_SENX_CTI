/* Dados fictícios da v0.1. Não representam gravações, pessoas ou métricas reais. */
window.SenxData = (() => {
  const clients = ['Maria Silva', 'João Ribeiro', 'Ana Lima', 'Pedro Rocha', 'Carla Alves', 'Felipe Santos', 'Bruno Costa', 'Lucas Carvalho'];
  const agents = ['Camila Souza', 'Lucas Oliveira', 'Mariana Costa', 'Rafael Almeida', 'Juliana Santos', 'Bruno Ferreira', 'Beatriz Lima', 'Diogo Ribeiro'];
  const teams = ['Atendimento', 'Suporte', 'Comercial'];
  const topics = ['Cancelamento', 'Dúvida', 'Oportunidade', 'Reclamação', 'Retenção', 'Cancelamento', 'Oportunidade', 'Informação'];
  const sentiments = ['Insatisfeito', 'Neutro', 'Satisfeito', 'Em análise', 'Satisfeito', 'Insatisfeito', 'Satisfeito', 'Neutro'];
  const statuses = ['Aguardando revisão', 'Concluída', 'Concluída', 'Em análise', 'Concluída', 'Aguardando revisão', 'Concluída', 'Não analisado'];
  const calls = Array.from({ length: 24 }, (_, i) => ({
    id: `LIG-${String(4248 + i).padStart(5, '0')}`, client: clients[i % 8], phone: `+55 (11) 9${8769 - i}-1321`,
    agent: agents[i % 8], team: teams[i % 3], date: `2026-10-${String(23 - Math.floor(i / 8)).padStart(2, '0')}`,
    time: `${String(10 - Math.floor((i % 8) / 4)).padStart(2, '0')}:${String((24 + i * 7) % 60).padStart(2, '0')}`,
    seconds: [317, 42, 757, 198, 118, 148, 592, 261][i % 8], topic: topics[i % 8], sentiment: sentiments[i % 8], status: statuses[i % 8],
    summary: i % 8 === 0 ? 'Cliente contesta uma cobrança duplicada na fatura. Relata contato anterior sem retorno e solicita correção antes do próximo vencimento.' : `Atendimento sobre ${topics[i % 8].toLowerCase()}. A pessoa relata sua necessidade e recebe orientação do setor responsável.`,
    nextStep: 'Conferir os dados do atendimento, validar a solicitação e retornar com uma posição ao cliente.',
    transcript: [
      { speaker: 'Cliente', time: '00:04', text: i % 8 === 0 ? 'Estou ligando porque veio uma cobrança duplicada e ainda não recebi retorno.' : 'Olá, preciso de uma orientação sobre meu atendimento.' },
      { speaker: 'Atendente', time: '00:18', text: 'Entendo. Vou conferir as informações e encaminhar sua solicitação para o setor responsável.' },
      { speaker: 'Cliente', time: '00:42', text: i % 8 === 0 ? 'Se essa cobrança não for resolvida, vou cancelar o serviço.' : 'Certo. Quando posso receber uma resposta?' },
      { speaker: 'Atendente', time: '01:10', text: 'Vou acompanhar o caso e retornar com uma posição até amanhã às 18h.' }
    ]
  }));
  const reports = [
    ['Ligações críticas · semana 15', 'Retenção', 'Atendimento', 'Aguardando revisão'],
    ['Qualidade do atendimento', 'Qualidade', 'Suporte', 'Concluído'],
    ['Prevenção de cancelamentos', 'Retenção', 'Comercial', 'Em andamento'],
    ['Falhas recorrentes por assunto', 'Desenvolvimento', 'Atendimento', 'Aguardando revisão'],
    ['Apoio a treinamentos', 'Desenvolvimento', 'Suporte', 'Concluído'],
    ['Oportunidades comerciais e de retenção', 'Retenção', 'Comercial', 'Concluído'],
    ['Acesso e gravações (LGPD)', 'Conformidade', 'Todos', 'Agendado']
  ].map((r, i) => ({ id: `REL-${i + 1}`, title: r[0], type: r[1], team: r[2], status: r[3], period: '17/10 – 23/10/2026' }));
  const rankings = agents.map((name, i) => ({ name, team: teams[i % 3], calls: [78, 65, 72, 69, 58, 61, 74, 56][i], quality: [96.4, 95.1, 94.7, 93.2, 92.8, 91.6, 90.9, 90.2][i], resolution: [94.9, 92.3, 91.7, 89.9, 89.7, 88.5, 87, 87.5][i], average: ['04:32','05:18','04:56','04:41','05:03','05:06','04:48','05:24'][i] }));
  const users = agents.slice(0, 7).map((name, i) => ({ id: `USR-${i + 1}`, name, email: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '.') + '@exemplo.senx', team: teams[i % 3], role: i < 3 ? 'Liderança' : 'Consulta', status: 'Ativo' }));
  const departments = teams.map((name, i) => ({ id: `DEP-${i + 1}`, name, leader: agents[i], description: ['Necessidades, encaminhamentos e retenção', 'Resolução técnica e procedimentos internos', 'Oportunidades e efetividade da condução'][i], criteria: [8, 7, 6][i] }));
  const criteria = [
    ['Assunto', 'Identificar o tema principal da ligação.', 'Trecho que nomeia o motivo do contato.'],
    ['Necessidade do cliente', 'Registrar a demanda expressa pelo cliente.', 'Fala com o pedido, problema ou resultado desejado.'],
    ['Encaminhamento', 'Identificar o destino e os próximos passos.', 'Orientação ou transferência citada, com responsável.'],
    ['Satisfação/insatisfação', 'Separar a percepção relatada da inferência de tom.', 'Fala explícita e contexto; revisão humana obrigatória.'],
    ['Possível cancelamento', 'Sinalizar menção expressa de encerrar o serviço.', 'Citação textual e contexto. Não confirmar cancelamento automaticamente.'],
    ['Cordialidade', 'Observar respeito e clareza na comunicação.', 'Trechos de saudação, escuta ou tratamento ao cliente.'],
    ['Efetividade', 'Avaliar a condução e a solução relatada.', 'Ação realizada e confirmação do resultado.'],
    ['Compromissos', 'Extrair acordos, responsáveis e prazos.', 'Fala com compromisso, responsável e prazo.'],
    ['Procedimentos internos', 'Verificar aderência aos procedimentos citados.', 'Etapas verificáveis na transcrição e regra aplicável.'],
    ['Oportunidades comerciais ou de retenção', 'Identificar interesse declarado ou chance de orientação.', 'Fala de interesse, objeção ou proposta apresentada.']
  ].map((r, i) => ({ id: `CRI-${i + 1}`, name: r[0], description: r[1], evidence: r[2], active: ![7, 9].includes(i) }));
  return { calls, reports, rankings, users, departments, criteria, profile: { name: 'Rafael Moura', email: 'rafael.moura@exemplo.senx', team: 'Atendimento', job: 'Gerente' } };
})();
