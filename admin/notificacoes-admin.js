(() => {
    const dadosSalvos = localStorage.getItem('usuario') || localStorage.getItem('tutor');
    let usuario = null;

    try {
        usuario = dadosSalvos ? JSON.parse(dadosSalvos) : null;
    } catch (erro) {
        console.error('Erro ao carregar usuário admin:', erro);
    }

    const usuarioId = usuario && (usuario.id || usuario.usuario_id);
    const botoes = document.querySelectorAll('.notification');
    if (!usuarioId || !botoes.length) return;

    const estilo = document.createElement('style');
    estilo.textContent = `
        .admin-notification-wrap { position: relative; }
        .admin-notification-count { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #dc2626; color: #fff; font: 700 10px Arial; display: flex; align-items: center; justify-content: center; }
        .admin-notification-panel { position: fixed; top: 76px; right: 28px; z-index: 3000; display: none; width: min(360px, calc(100vw - 32px)); max-height: 460px; overflow: auto; background: #fff; border: 1px solid #d9eef7; border-radius: 10px; box-shadow: 0 10px 28px rgba(38, 50, 56, .18); }
        .admin-notification-panel.open { display: block; }
        .admin-notification-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #e5eef2; color: #28556b; font-weight: 700; }
        .admin-notification-header button { border: 0; background: none; color: #397a99; cursor: pointer; font-size: 12px; }
        .admin-notification-item { display: block; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid #eef4f6; background: #fff; text-align: left; cursor: pointer; }
        .admin-notification-item:hover, .admin-notification-item.unread { background: #f0f9fc; }
        .admin-notification-item strong, .admin-notification-item span, .admin-notification-item small { display: block; }
        .admin-notification-item strong { color: #28556b; font-size: 13px; }
        .admin-notification-item span { margin-top: 4px; color: #607d8b; font-size: 12px; line-height: 1.4; }
        .admin-notification-item small { margin-top: 6px; color: #8aa0aa; font-size: 10px; }
        .admin-notification-empty { padding: 22px 16px; color: #607d8b; text-align: center; font-size: 13px; }
    `;
    document.head.appendChild(estilo);

    const painel = document.createElement('div');
    painel.className = 'admin-notification-panel';
    painel.innerHTML = '<div class="admin-notification-header"><span>Notificações</span><button type="button" id="marcarNotificacoesAdmin">Marcar todas como lidas</button></div><div id="listaNotificacoesAdmin"></div>';
    document.body.appendChild(painel);

    function escapar(valor) {
        const div = document.createElement('div');
        div.textContent = valor || '';
        return div.innerHTML;
    }

    async function carregar() {
        const resposta = await fetch(`/api/notificacoes?usuario_id=${encodeURIComponent(usuarioId)}`);
        if (!resposta.ok) return;
        const notificacoes = await resposta.json();
        const naoLidas = notificacoes.filter(item => !item.lida).length;
        document.querySelectorAll('.admin-notification-count').forEach(item => item.remove());
        if (naoLidas) {
            botoes.forEach(botao => {
                const contador = document.createElement('span');
                contador.className = 'admin-notification-count';
                contador.textContent = naoLidas > 99 ? '99+' : naoLidas;
                botao.parentNode.appendChild(contador);
            });
        }

        const lista = document.getElementById('listaNotificacoesAdmin');
        lista.innerHTML = notificacoes.length ? notificacoes.map(item => `
            <button class="admin-notification-item ${item.lida ? '' : 'unread'}" data-id="${item.id}" data-link="${escapar(item.link || '')}">
                <strong>${escapar(item.titulo)}</strong><span>${escapar(item.mensagem)}</span><small>${new Date(item.data).toLocaleString('pt-BR')}</small>
            </button>
        `).join('') : '<div class="admin-notification-empty">Nenhuma notificação no momento.</div>';

        lista.querySelectorAll('.admin-notification-item').forEach(item => item.addEventListener('click', async () => {
            await fetch(`/api/notificacoes/${item.dataset.id}/lida`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: usuarioId }) });
            if (item.dataset.link) window.location.href = item.dataset.link;
            else carregar();
        }));
    }

    botoes.forEach(botao => {
        botao.classList.add('admin-notification-trigger');
        const envoltorio = document.createElement('span');
        envoltorio.className = 'admin-notification-wrap';
        botao.parentNode.insertBefore(envoltorio, botao);
        envoltorio.appendChild(botao);
        botao.addEventListener('click', event => {
            event.stopPropagation();
            painel.classList.toggle('open');
            carregar();
        });
    });

    document.addEventListener('click', event => {
        if (!painel.contains(event.target) && !event.target.closest('.admin-notification-trigger')) painel.classList.remove('open');
    });
    document.getElementById('marcarNotificacoesAdmin').addEventListener('click', async event => {
        event.stopPropagation();
        await fetch('/api/notificacoes/lidas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: usuarioId }) });
        carregar();
    });

    carregar();
    setInterval(carregar, 30000);
})();
