(() => {
    const tutorStorage = localStorage.getItem('tutor');
    const tutor = tutorStorage ? JSON.parse(tutorStorage) : null;
    const usuarioId = tutor && tutor.id ? tutor.id : null;
    const botoes = document.querySelectorAll('.notification');

    if (!usuarioId || !botoes.length) return;

    const estilo = document.createElement('style');
    estilo.textContent = `
        .notification-wrap { position: relative; }
        .notification-count { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #dc2626; color: #fff; font: 700 10px Arial; display: flex; align-items: center; justify-content: center; }
        .notification-panel { position: fixed; top: 72px; right: 24px; width: min(360px, calc(100vw - 32px)); max-height: 460px; overflow: auto; background: #fff; border: 1px solid #d9eef7; border-radius: 10px; box-shadow: 0 10px 28px rgba(38, 50, 56, .18); z-index: 3000; display: none; }
        .notification-panel.open { display: block; }
        .notification-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #e5eef2; color: #28556b; font-weight: 700; }
        .notification-panel-header button { border: 0; background: none; color: #397a99; cursor: pointer; font-size: 12px; }
        .notification-item { display: block; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid #eef4f6; background: #fff; text-align: left; cursor: pointer; }
        .notification-item:hover, .notification-item.unread { background: #f0f9fc; }
        .notification-item strong { display: block; color: #28556b; font-size: 13px; }
        .notification-item span { display: block; margin-top: 4px; color: #607d8b; font-size: 12px; line-height: 1.4; }
        .notification-item small { display: block; margin-top: 6px; color: #8aa0aa; font-size: 10px; }
        .notification-empty { padding: 22px 16px; color: #607d8b; text-align: center; font-size: 13px; }
        .notification-toast { position: fixed; right: 24px; bottom: 24px; z-index: 4000; width: min(360px, calc(100vw - 32px)); padding: 14px 16px; border: 1px solid #b9e3f2; border-left: 4px solid #397a99; border-radius: 10px; background: #fff; box-shadow: 0 10px 28px rgba(38, 50, 56, .2); color: #28556b; }
        .notification-toast strong, .notification-toast span { display: block; }
        .notification-toast span { margin-top: 4px; color: #607d8b; font-size: 12px; line-height: 1.4; }
    `;
    document.head.appendChild(estilo);

    const painel = document.createElement('div');
    painel.className = 'notification-panel';
    painel.innerHTML = `
        <div class="notification-panel-header">
            <span>Notificações</span>
            <button type="button" id="marcarTodasNotificacoes">Marcar todas como lidas</button>
        </div>
        <div id="listaNotificacoes"></div>
    `;
    document.body.appendChild(painel);
    let primeiraCarga = true;
    const notificacoesConhecidas = new Set();

    botoes.forEach(botao => {
        botao.classList.add('notification-trigger');
        const envoltorio = document.createElement('span');
        envoltorio.className = 'notification-wrap';
        botao.parentNode.insertBefore(envoltorio, botao);
        envoltorio.appendChild(botao);
        botao.addEventListener('click', (event) => {
            event.stopPropagation();
            painel.classList.toggle('open');
            carregarNotificacoes();
        });
    });

    document.addEventListener('click', (event) => {
        if (!painel.contains(event.target) && !event.target.closest('.notification-trigger')) {
            painel.classList.remove('open');
        }
    });

    function escaparHTML(valor) {
        const div = document.createElement('div');
        div.textContent = valor || '';
        return div.innerHTML;
    }

    function formatarData(valor) {
        return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    async function carregarNotificacoes() {
        try {
            const resposta = await fetch(`/api/notificacoes?usuario_id=${encodeURIComponent(usuarioId)}`);
            if (!resposta.ok) return;
            const notificacoes = await resposta.json();
            const lista = document.getElementById('listaNotificacoes');
            const naoLidas = notificacoes.filter(notificacao => !notificacao.lida).length;

            const novas = notificacoes.filter(notificacao => !notificacao.lida && !notificacoesConhecidas.has(notificacao.id));
            novas.slice(0, primeiraCarga ? 1 : novas.length).forEach(mostrarToast);
            notificacoes.forEach(notificacao => notificacoesConhecidas.add(notificacao.id));
            primeiraCarga = false;

            document.querySelectorAll('.notification-count').forEach(elemento => elemento.remove());
            if (naoLidas > 0) {
                botoes.forEach(botao => {
                    const contador = document.createElement('span');
                    contador.className = 'notification-count';
                    contador.textContent = naoLidas > 99 ? '99+' : naoLidas;
                    botao.parentNode.appendChild(contador);
                });
            }

            if (!notificacoes.length) {
                lista.innerHTML = '<div class="notification-empty">Nenhuma notificação no momento.</div>';
                return;
            }

            lista.innerHTML = notificacoes.map(notificacao => `
                <button type="button" class="notification-item ${notificacao.lida ? '' : 'unread'}" data-id="${notificacao.id}" data-link="${escaparHTML(notificacao.link || '')}">
                    <strong>${escaparHTML(notificacao.titulo)}</strong>
                    <span>${escaparHTML(notificacao.mensagem)}</span>
                    <small>${formatarData(notificacao.data)}</small>
                </button>
            `).join('');

            lista.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', () => abrirNotificacao(item));
            });
        } catch (erro) {
            console.error('Erro ao carregar notificações:', erro);
        }
    }

    async function verificarLembreteLocal() {
        try {
            const resposta = await fetch(`/api/agendamentos/tutor/${encodeURIComponent(usuarioId)}`);
            if (!resposta.ok) return;
            const consultas = await resposta.json();
            consultas.forEach(consulta => {
                const data = String(consulta.data || '').slice(0, 10);
                const hora = String(consulta.horario || '').slice(0, 8);
                const horarioConsulta = new Date(`${data}T${hora}`);
                const minutosRestantes = (horarioConsulta.getTime() - Date.now()) / 60000;
                const chave = `lembrete-local-10min-${consulta.id}`;

                if (minutosRestantes <= 10 && minutosRestantes > -2 && !sessionStorage.getItem(chave)) {
                    sessionStorage.setItem(chave, '1');
                    mostrarToast({
                        titulo: 'Lembrete de consulta',
                        mensagem: `A consulta de ${consulta.pet} começa em até 10 minutos.`
                    });
                }
            });
        } catch (erro) {
            console.error('Erro ao verificar lembrete local:', erro);
        }
    }

    function mostrarToast(notificacao) {
        document.querySelectorAll('.notification-toast').forEach(elemento => elemento.remove());
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `<strong>${escaparHTML(notificacao.titulo)}</strong><span>${escaparHTML(notificacao.mensagem)}</span>`;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 8000);
    }

    async function abrirNotificacao(item) {
        await fetch(`/api/notificacoes/${item.dataset.id}/lida`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId })
        });
        const link = item.dataset.link;
        if (link) window.location.href = link;
        else carregarNotificacoes();
    }

    document.getElementById('marcarTodasNotificacoes').addEventListener('click', async (event) => {
        event.stopPropagation();
        await fetch('/api/notificacoes/lidas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId })
        });
        carregarNotificacoes();
    });

    carregarNotificacoes();
    verificarLembreteLocal();
    setInterval(carregarNotificacoes, 1000);
    setInterval(verificarLembreteLocal, 5000);
})();
