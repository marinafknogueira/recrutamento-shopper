const STATUS_LABEL = {
  rascunho: 'Rascunho',
  aguardando_aprovacao_ceo: 'Aguardando aprovação do CEO',
  reprovada: 'Reprovada',
  aprovada_aguardando_priorizacao: 'Aprovada — aguardando priorização',
  em_recrutamento: 'Em recrutamento',
  preenchida: 'Preenchida',
  encerrada: 'Encerrada',
};

const ROLE_LABEL = { admin: 'admin', ceo: 'ceo', gestor: 'gestor', talentos: 'talentos' };

const FIELD_LABEL = {
  cargo: 'Nome do cargo',
  senioridade: 'Senioridade',
  setor: 'Setor',
  centro_custo: 'Centro de custo',
  gestor_email: 'Gestor',
  requisitos: 'Requisitos',
  responsabilidades: 'Descrição das responsabilidades',
  pergunta_entrevista_1: 'Pergunta de entrevista 1',
  pergunta_entrevista_2: 'Pergunta de entrevista 2',
  pergunta_entrevista_3: 'Pergunta de entrevista 3',
  faixa_salarial: 'Faixa salarial',
  quantidade_vagas: 'Quantidade de vagas',
  recrutamento: 'Recrutamento',
  reporte_direto: 'Reporte direto',
  unidade: 'Unidade',
  tipo_vaga: 'Tipo de vaga',
};

const state = {
  user: null,
  config: null,
  view: 'list',
  jobs: [],
  selectedJob: null,
  users: [],
};

const app = document.getElementById('app');

// API base URL - funciona automaticamente em dev (localhost) e prod (Vercel)
const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

async function api(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado');
  return data;
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function init() {
  state.config = await api('/api/config');
  try {
    state.user = await api('/api/auth/me');
    await loadJobs();
    render();
  } catch (e) {
    renderLogin();
  }
}

function renderLogin(errorMsg) {
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-mark">esteira de recrutamento</div>
      <h1 class="login-title">Um único fluxo para abrir, aprovar e priorizar vagas na Shopper</h1>
      <p class="login-sub">Entre com seu e-mail corporativo Google para continuar.</p>
      ${errorMsg ? `<div class="login-error">${errorMsg}</div>` : ''}
      <div class="login-box"><div id="google-btn"></div></div>
    </div>
  `;
  if (window.google && state.config.googleClientId) {
    google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: onGoogleCredential,
    });
    google.accounts.id.renderButton(document.getElementById('google-btn'), {
      theme: 'outline', size: 'large', text: 'signin_with',
    });
  } else {
    document.getElementById('google-btn').textContent = 'Carregando login do Google...';
    setTimeout(() => { if (!state.user) renderLogin(errorMsg); }, 800);
  }
}

async function onGoogleCredential(response) {
  try {
    state.user = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential }),
    });
    await loadJobs();
    render();
  } catch (e) {
    renderLogin(e.message);
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  renderLogin();
}

async function loadJobs() {
  state.jobs = await api('/api/jobs');
}

async function loadUsers() {
  state.users = await api('/api/users');
}

function navItems() {
  const items = [{ key: 'list', label: 'Vagas' }];
  if (['gestor', 'admin'].includes(state.user.role)) items.push({ key: 'new', label: 'Nova vaga' });
  if (['talentos', 'admin'].includes(state.user.role)) items.push({ key: 'score', label: 'Pontuação' });
  if (state.user.role === 'admin') items.push({ key: 'users', label: 'Usuários' });
  return items;
}

function render() {
  const items = navItems();
  app.innerHTML = `
    <div class="shell">
      <div class="sidebar">
        <div>
          <div class="sidebar-brand">Recrutamento Shopper</div>
          <div class="sidebar-role">${state.user.name || state.user.email} · ${ROLE_LABEL[state.user.role]}</div>
        </div>
        <ul class="nav-list">
          ${items.map(i => `<li class="nav-item ${state.view === i.key ? 'active' : ''}" data-nav="${i.key}">${i.label}</li>`).join('')}
        </ul>
        <button class="logout-btn" id="logout-btn">Sair</button>
      </div>
      <div class="main" id="main"></div>
    </div>
  `;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => { state.view = el.dataset.nav; state.selectedJob = null; render(); });
  });
  document.getElementById('logout-btn').addEventListener('click', logout);

  const main = document.getElementById('main');
  if (state.view === 'list') renderList(main);
  else if (state.view === 'new') renderJobForm(main);
  else if (state.view === 'detail') renderDetail(main);
  else if (state.view === 'score') renderScore(main);
  else if (state.view === 'users') renderUsers(main);
}

function viewTitleForRole() {
  switch (state.user.role) {
    case 'gestor': return ['Minhas vagas', 'Acompanhe o estágio de cada vaga que você abriu.'];
    case 'ceo': return ['Vagas', 'Aprove ou reprove as vagas aguardando sua decisão.'];
    case 'talentos': return ['Vagas em andamento', 'Priorize e conduza as vagas aprovadas.'];
    default: return ['Todas as vagas', 'Visão completa de todas as etapas do processo.'];
  }
}

function renderList(main) {
  const [title, sub] = viewTitleForRole();
  const jobs = state.jobs;
  main.innerHTML = `
    <h1 class="page-title">${title}</h1>
    <p class="page-sub">${sub}</p>
    ${jobs.length === 0 ? `<div class="empty-state">Nenhuma vaga por aqui ainda.</div>` : `
      <div class="job-list">
        ${jobs.map(j => `
          <div class="job-card" data-id="${j.id}">
            <div class="job-card-main">
              <div class="job-card-title">${escapeHtml(j.cargo)} — ${escapeHtml(j.senioridade)}</div>
              <div class="job-card-meta">${escapeHtml(j.setor)} · ${escapeHtml(j.unidade)} · gestor: ${escapeHtml(j.gestor_email)}</div>
            </div>
            <span class="badge badge-${j.status}">${STATUS_LABEL[j.status]}</span>
          </div>
        `).join('')}
      </div>
    `}
  `;
  main.querySelectorAll('.job-card').forEach(el => {
    el.addEventListener('click', async () => {
      state.selectedJob = await api(`/api/jobs/${el.dataset.id}`);
      state.view = 'detail';
      render();
    });
  });
}

function jobFormFieldsHtml(job = {}) {
  const v = (k, d = '') => (job[k] !== undefined && job[k] !== null ? job[k] : d);
  return `
    <div class="form-field">
      <label>Nome do cargo</label>
      <input name="cargo" required value="${escapeAttr(v('cargo'))}" />
    </div>
    <div class="form-field">
      <label>Senioridade</label>
      <select name="senioridade" required>
        ${['Estagiário','Júnior','Pleno','Sênior','Especialista','Coordenação','Gerência','Diretoria'].map(o =>
          `<option ${v('senioridade') === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label>Setor</label>
      <input name="setor" required value="${escapeAttr(v('setor'))}" />
    </div>
    <div class="form-field">
      <label>Centro de custo</label>
      <input name="centro_custo" required value="${escapeAttr(v('centro_custo'))}" />
    </div>
    <div class="form-field">
      <label>Unidade</label>
      <input name="unidade" required value="${escapeAttr(v('unidade'))}" />
    </div>
    <div class="form-field">
      <label>Reporte direto</label>
      <input name="reporte_direto" required value="${escapeAttr(v('reporte_direto'))}" placeholder="Nome/cargo de quem a pessoa vai reportar" />
    </div>
    <div class="form-field">
      <label>Tipo de vaga</label>
      <select name="tipo_vaga" required>
        <option value="aumento_quadro" ${v('tipo_vaga') === 'aumento_quadro' ? 'selected' : ''}>Aumento de quadro</option>
        <option value="substituicao" ${v('tipo_vaga') === 'substituicao' ? 'selected' : ''}>Substituição</option>
      </select>
    </div>
    <div class="form-field">
      <label>Recrutamento</label>
      <select name="recrutamento" required>
        <option value="interno" ${v('recrutamento') === 'interno' ? 'selected' : ''}>Interno</option>
        <option value="externo" ${v('recrutamento') === 'externo' ? 'selected' : ''}>Externo</option>
      </select>
    </div>
    <div class="form-field">
      <label>Quantidade de vagas</label>
      <input name="quantidade_vagas" type="number" min="1" required value="${escapeAttr(v('quantidade_vagas', 1))}" />
    </div>
    <div class="form-field">
      <label>Faixa salarial</label>
      <input name="faixa_salarial" required value="${escapeAttr(v('faixa_salarial'))}" placeholder="ex: R$ 6.000 a R$ 8.500" />
    </div>
    <div class="form-field full">
      <label>Requisitos</label>
      <textarea name="requisitos" required>${escapeHtml(v('requisitos'))}</textarea>
    </div>
    <div class="form-field full">
      <label>Descrição das responsabilidades da vaga</label>
      <textarea name="responsabilidades" required>${escapeHtml(v('responsabilidades'))}</textarea>
    </div>
    <div class="form-field full">
      <label>Pergunta de entrevista 1</label>
      <input name="pergunta_entrevista_1" required value="${escapeAttr(v('pergunta_entrevista_1'))}" />
    </div>
    <div class="form-field full">
      <label>Pergunta de entrevista 2</label>
      <input name="pergunta_entrevista_2" required value="${escapeAttr(v('pergunta_entrevista_2'))}" />
    </div>
    <div class="form-field full">
      <label>Pergunta de entrevista 3</label>
      <input name="pergunta_entrevista_3" required value="${escapeAttr(v('pergunta_entrevista_3'))}" />
    </div>
  `;
}

function renderJobForm(main, editingJob = null) {
  main.innerHTML = `
    <h1 class="page-title">${editingJob ? 'Editar vaga' : 'Nova vaga'}</h1>
    <p class="page-sub">Preencha o job description completo. Todos os campos são obrigatórios.</p>
    <form id="job-form" class="form-grid">
      ${jobFormFieldsHtml(editingJob || {})}
      <div class="error-msg" id="form-error"></div>
      <div class="form-actions">
        <button type="submit" class="primary">${editingJob ? 'Salvar alterações' : 'Salvar rascunho'}</button>
        <button type="button" class="secondary" id="cancel-form">Cancelar</button>
      </div>
    </form>
  `;
  document.getElementById('cancel-form').addEventListener('click', () => { state.view = 'list'; render(); });
  document.getElementById('job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.quantidade_vagas = parseInt(body.quantidade_vagas, 10);
    try {
      if (editingJob) {
        await api(`/api/jobs/${editingJob.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Vaga atualizada.');
      } else {
        await api('/api/jobs', { method: 'POST', body: JSON.stringify(body) });
        toast('Vaga salva como rascunho.');
      }
      await loadJobs();
      state.view = 'list';
      render();
    } catch (err) {
      document.getElementById('form-error').textContent = err.message;
    }
  });
}

function detailItem(label, value, full = false) {
  return `<div class="detail-item ${full ? 'full' : ''}"><dt>${label}</dt><dd>${escapeHtml(value ?? '—')}</dd></div>`;
}

function renderDetail(main) {
  const job = state.selectedJob;
  const role = state.user.role;
  const canEdit = (role === 'admin') || (role === 'gestor' && job.gestor_email === state.user.email && ['rascunho', 'reprovada'].includes(job.status));
  const canSubmit = (role === 'admin' || role === 'gestor') && ['rascunho', 'reprovada'].includes(job.status) && (role === 'admin' || job.gestor_email === state.user.email);
  const canDecide = (role === 'admin' || role === 'ceo') && job.status === 'aguardando_aprovacao_ceo';
  const canPriorizar = (role === 'admin' || role === 'talentos') && job.status === 'aprovada_aguardando_priorizacao';
  const canClose = (role === 'admin' || role === 'talentos') && job.status === 'em_recrutamento';

  main.innerHTML = `
    <button class="back-link" id="back-btn">← Voltar para a lista</button>
    <div class="detail-header">
      <div>
        <h1 class="page-title">${escapeHtml(job.cargo)} — ${escapeHtml(job.senioridade)}</h1>
        <p class="page-sub">Gestor: ${escapeHtml(job.gestor_email)}</p>
      </div>
      <span class="badge badge-${job.status}">${STATUS_LABEL[job.status]}</span>
    </div>

    <div class="detail-panel">
      <dl class="detail-grid">
        ${detailItem('Setor', job.setor)}
        ${detailItem('Centro de custo', job.centro_custo)}
        ${detailItem('Unidade', job.unidade)}
        ${detailItem('Reporte direto', job.reporte_direto)}
        ${detailItem('Tipo de vaga', job.tipo_vaga === 'aumento_quadro' ? 'Aumento de quadro' : 'Substituição')}
        ${detailItem('Recrutamento', job.recrutamento === 'interno' ? 'Interno' : 'Externo')}
        ${detailItem('Quantidade de vagas', job.quantidade_vagas)}
        ${detailItem('Faixa salarial', job.faixa_salarial)}
        ${detailItem('Requisitos', job.requisitos, true)}
        ${detailItem('Descrição das responsabilidades', job.responsabilidades, true)}
        ${detailItem('Pergunta de entrevista 1', job.pergunta_entrevista_1, true)}
        ${detailItem('Pergunta de entrevista 2', job.pergunta_entrevista_2, true)}
        ${detailItem('Pergunta de entrevista 3', job.pergunta_entrevista_3, true)}
        ${job.motivo_reprovacao ? detailItem('Motivo da reprovação', job.motivo_reprovacao, true) : ''}
        ${job.prioridade ? detailItem('Prioridade', job.prioridade) : ''}
        ${job.responsavel_talentos ? detailItem('Responsável (Talentos)', job.responsavel_talentos) : ''}
      </dl>
    </div>

    <div class="detail-panel" id="action-panel"></div>

    <h2 class="page-title" style="font-size:17px;">Histórico</h2>
    <div class="detail-panel">
      ${job.history.map(h => `
        <div class="history-item">
          <div class="history-when">${new Date(h.changed_at + 'Z').toLocaleString('pt-BR')}</div>
          <div><strong>${STATUS_LABEL[h.status_to] || h.status_to}</strong> — por ${escapeHtml(h.changed_by)}${h.comentario ? ` · ${escapeHtml(h.comentario)}` : ''}</div>
        </div>
      `).join('') || '<p class="page-sub">Sem histórico.</p>'}
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => { state.view = 'list'; render(); });

  const panel = document.getElementById('action-panel');
  const actions = [];

  if (canEdit) actions.push(`<button class="secondary" id="edit-btn">Editar vaga</button>`);
  if (canSubmit) actions.push(`<button class="primary" id="submit-btn">Enviar para aprovação do CEO</button>`);
  if (canDecide) {
    actions.push(`<button class="primary" id="approve-btn">Aprovar vaga</button>`);
    actions.push(`<button class="danger" id="reject-btn">Reprovar vaga</button>`);
  }
  if (canPriorizar) actions.push(`<button class="primary" id="priorizar-btn">Definir prioridade e responsável</button>`);
  if (canClose) {
    actions.push(`<button class="primary" id="fill-btn">Marcar como preenchida</button>`);
    actions.push(`<button class="secondary" id="close-btn">Encerrar vaga</button>`);
  }

  panel.innerHTML = actions.length
    ? `<div class="form-actions" style="margin-top:0;">${actions.join('')}</div><div id="inline-form"></div>`
    : `<p class="page-sub" style="margin:0;">Nenhuma ação disponível para você nesta etapa.</p>`;

  if (canEdit) document.getElementById('edit-btn').addEventListener('click', () => { state.view = 'editform'; renderEditFormWrap(job); });
  if (canSubmit) document.getElementById('submit-btn').addEventListener('click', () => doAction(`/api/jobs/${job.id}/submit`, {}, 'Vaga enviada para aprovação.'));
  if (canDecide) {
    document.getElementById('approve-btn').addEventListener('click', () => doAction(`/api/jobs/${job.id}/approve`, {}, 'Vaga aprovada.'));
    document.getElementById('reject-btn').addEventListener('click', () => {
      document.getElementById('inline-form').innerHTML = `
        <div class="form-field full" style="margin-top:14px;">
          <label>Motivo da reprovação</label>
          <textarea id="motivo-input"></textarea>
          <button class="danger" style="margin-top:8px; width:fit-content;" id="confirm-reject">Confirmar reprovação</button>
        </div>`;
      document.getElementById('confirm-reject').addEventListener('click', () =>
        doAction(`/api/jobs/${job.id}/reject`, { motivo: document.getElementById('motivo-input').value }, 'Vaga reprovada.'));
    });
  }
  if (canPriorizar) {
    document.getElementById('priorizar-btn').addEventListener('click', () => {
      document.getElementById('inline-form').innerHTML = `
        <div class="form-grid" style="margin-top:14px; padding:0; border:none;">
          <div class="form-field">
            <label>Prioridade</label>
            <select id="prioridade-input">
              <option>Alta</option><option>Média</option><option>Baixa</option>
            </select>
          </div>
          <div class="form-field">
            <label>Responsável (Talentos)</label>
            <input id="responsavel-input" placeholder="e-mail do responsável" />
          </div>
          <div class="form-actions">
            <button class="primary" id="confirm-priorizar">Confirmar e mover para recrutamento</button>
          </div>
        </div>`;
      document.getElementById('confirm-priorizar').addEventListener('click', () =>
        doAction(`/api/jobs/${job.id}/priorizar`, {
          prioridade: document.getElementById('prioridade-input').value,
          responsavel_talentos: document.getElementById('responsavel-input').value,
        }, 'Vaga priorizada e movida para recrutamento.'));
    });
  }
  if (canClose) {
    document.getElementById('fill-btn').addEventListener('click', () => doAction(`/api/jobs/${job.id}/status`, { status: 'preenchida' }, 'Vaga marcada como preenchida.'));
    document.getElementById('close-btn').addEventListener('click', () => doAction(`/api/jobs/${job.id}/status`, { status: 'encerrada' }, 'Vaga encerrada.'));
  }
}

function renderEditFormWrap(job) {
  const main = document.getElementById('main');
  renderJobForm(main, job);
}

async function doAction(url, body, successMsg) {
  try {
    await api(url, { method: 'POST', body: JSON.stringify(body) });
    toast(successMsg);
    await loadJobs();
    state.selectedJob = await api(`/api/jobs/${state.selectedJob.id}`);
    render();
  } catch (e) {
    toast(e.message, true);
  }
}

async function renderScore(main) {
  main.innerHTML = `<p class="page-sub">Carregando pontuação...</p>`;
  let data;
  try {
    data = await api('/api/score');
  } catch (e) {
    main.innerHTML = `<p class="page-sub">Não foi possível carregar a pontuação: ${escapeHtml(e.message)}</p>`;
    return;
  }

  const pctEquipe = Math.min(100, Math.round((data.totalEquipe / data.metaEquipe) * 100));
  const role = state.user.role;

  let html = `
    <h1 class="page-title">Pontuação de contratações</h1>
    <p class="page-sub">Cada vaga preenchida soma pontos conforme o cargo contratado. Meta da equipe: ${data.metaEquipe} pontos por semestre.</p>
    <div class="score-cards">
      <div class="score-card">
        <h3>Equipe — total do semestre</h3>
        <div class="big">${data.totalEquipe} <small>/ ${data.metaEquipe} pts</small></div>
        <div class="score-bar-track"><div class="score-bar-fill${pctEquipe >= 100 ? ' over' : ''}" style="width:${pctEquipe}%;"></div></div>
        <div class="score-meta">${pctEquipe}% da meta semestral da equipe</div>
      </div>
  `;

  if (role === 'talentos') {
    html += `
      <div class="score-card">
        <h3>Sua pontuação</h3>
        <div class="big">${data.meuPontos} <small>pts</small></div>
        <div class="score-meta">Meta individual: a definir por senioridade. Visível só para você e para o Admin (Gente e Gestão).</div>
      </div>
    `;
  }
  html += `</div>`;

  if (role === 'admin' && data.pontosPorPessoa) {
    html += `
      <h2 class="page-title" style="font-size:17px;">Pontuação por pessoa</h2>
      <p class="page-sub" style="margin-top:-6px;">Esta tabela só aparece para o Admin. Cada pessoa de Talentos vê apenas a própria pontuação.</p>
      <table class="score-table"><thead><tr><th></th><th>Pessoa</th><th style="text-align:right;">Pontos no semestre</th></tr></thead><tbody>
        ${data.pontosPorPessoa.map((l, i) => `
          <tr><td class="score-rank">${i + 1}º</td><td>${escapeHtml(l.name || l.email)}</td><td class="num">${l.pontos}</td></tr>
        `).join('')}
      </tbody></table>
    `;
  }

  const ref = data.pontosReferencia;
  html += `
    <details class="score-ref">
      <summary>Ver tabela de pontos por cargo contratado</summary>
      <table class="score-points-table"><thead><tr><th>Senioridade</th><th>Outras áreas</th><th>Tecnologia</th></tr></thead><tbody>
        ${ref.senioridades.filter(s => ref.outrasAreas[s] !== undefined).map(s => `
          <tr><td>${escapeHtml(s)}</td><td>${ref.outrasAreas[s]}</td><td>${ref.tecnologia[s]}</td></tr>
        `).join('')}
      </tbody></table>
    </details>
  `;

  main.innerHTML = html;
}

async function renderUsers(main) {
  await loadUsers();
  main.innerHTML = `
    <h1 class="page-title">Usuários</h1>
    <p class="page-sub">Controle quais e-mails corporativos têm acesso e em qual nível.</p>
    <form id="add-user-form" class="form-grid" style="margin-bottom:24px;">
      <div class="form-field">
        <label>E-mail corporativo</label>
        <input name="email" type="email" required placeholder="pessoa@${state.config.companyDomain || 'empresa.com'}" />
      </div>
      <div class="form-field">
        <label>Nível de acesso</label>
        <select name="role" required>
          <option value="gestor">Gestor</option>
          <option value="ceo">CEO</option>
          <option value="talentos">Talentos</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary">Adicionar / atualizar acesso</button>
      </div>
    </form>
    <table class="users-table">
      <thead><tr><th>E-mail</th><th>Nome</th><th>Nível</th><th></th></tr></thead>
      <tbody>
        ${state.users.map(u => `
          <tr>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.name || '—')}</td>
            <td>
              <select class="pill-select" data-email="${u.email}">
                ${['admin','ceo','gestor','talentos'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </td>
            <td><button class="danger" data-remove="${u.email}">Remover</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd.entries())) });
      toast('Acesso atualizado.');
      renderUsers(main);
    } catch (err) { toast(err.message, true); }
  });

  main.querySelectorAll('[data-email]').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await api('/api/users', { method: 'POST', body: JSON.stringify({ email: sel.dataset.email, role: sel.value }) });
        toast('Nível atualizado.');
      } catch (err) { toast(err.message, true); }
    });
  });

  main.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/users/${encodeURIComponent(btn.dataset.remove)}`, { method: 'DELETE' });
        toast('Acesso removido.');
        renderUsers(main);
      } catch (err) { toast(err.message, true); }
    });
  });
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

init();
