(() => {
    // ---------- Perfil do usuário logado ----------
    const dadosSalvos = localStorage.getItem('usuario') || localStorage.getItem('tutor');
    let usuario = {};
    try {
        usuario = dadosSalvos ? JSON.parse(dadosSalvos) : {};
    } catch (e) { console.error('Erro ao ler usuário logado:', e); }

    const nomeVetLogado = usuario.nome || 'Veterinário';
    const partesNome = nomeVetLogado.trim().split(/\s+/).filter(Boolean);
    const iniciais = partesNome.length > 1
        ? `${partesNome[0][0]}${partesNome[partesNome.length - 1][0]}`
        : (partesNome[0] || 'V').substring(0, 2);

    document.querySelectorAll('[data-vet-name]').forEach(el => el.textContent = nomeVetLogado);
    document.querySelectorAll('[data-vet-initials]').forEach(el => el.textContent = iniciais.toUpperCase());

    function fazerLogout() {
        localStorage.removeItem('usuario');
        localStorage.removeItem('tutor');
        window.location.href = '../login.html';
    }
    window.fazerLogout = fazerLogout;

    // ---------- Abas ----------
    document.querySelectorAll('.aba-btn').forEach(botao => {
        botao.addEventListener('click', () => {
            document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.aba-conteudo').forEach(s => s.classList.remove('active'));
            botao.classList.add('active');
            document.getElementById('aba-' + botao.dataset.aba).classList.add('active');
        });
    });

    // ---------- Utilidades ----------
    function escapar(valor) {
        const div = document.createElement('div');
        div.textContent = valor == null ? '' : String(valor);
        return div.innerHTML;
    }

    function formatarData(valor) {
        if (!valor) return '-';
        const data = new Date(valor);
        if (isNaN(data)) return String(valor).slice(0, 10);
        return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    async function api(url, opcoes) {
        const resposta = await fetch(url, opcoes);
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || 'Erro na requisição.');
        return dados;
    }

    // ---------- RF-03: Veterinários ----------
    let listaVets = [];

    async function carregarVeterinarios() {
        const tbody = document.getElementById('tabela-veterinarios');
        try {
            listaVets = await api('/api/veterinarios');
            renderizarVeterinarios(listaVets);
            preencherSelectVets();
        } catch (erro) {
            console.error(erro);
            tbody.innerHTML = `<tr><td colspan="4" class="vazio" style="color:#d9534f;">${escapar(erro.message)}</td></tr>`;
        }
    }

    function renderizarVeterinarios(vets) {
        const tbody = document.getElementById('tabela-veterinarios');
        if (!vets || !vets.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="vazio">Nenhum veterinário cadastrado.</td></tr>';
            return;
        }
        tbody.innerHTML = vets.map(vet => `
            <tr>
                <td><strong>${escapar(vet.nome)}</strong></td>
                <td>${escapar(vet.email)}</td>
                <td><span class="status-badge-mini">${escapar(vet.area_atuacao || 'Clínica geral')}</span></td>
                <td>
                    <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px;" onclick="alterarArea(${vet.id})">
                        <i class="fa-solid fa-pen"></i> Área
                    </button>
                    <button onclick="excluirVeterinario(${vet.id})" style="border:none;background:none;color:#d9534f;cursor:pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.alterarArea = async function (id) {
        const vet = listaVets.find(v => v.id === id);
        const atual = prompt('Nova área de atuação:', vet ? (vet.area_atuacao || 'Clínica geral') : 'Clínica geral');
        if (!atual) return;
        try {
            const resultado = await api(`/api/veterinarios/${id}/area`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ area_atuacao: atual })
            });
            alert(resultado.mensagem);
            carregarVeterinarios();
        } catch (erro) {
            alert('Erro: ' + erro.message);
        }
    };

    window.excluirVeterinario = async function (id) {
        if (!confirm('Deseja realmente excluir este veterinário?')) return;
        try {
            await api(`/api/veterinarios/${id}`, { method: 'DELETE' });
            carregarVeterinarios();
        } catch (erro) {
            alert('Erro: ' + erro.message);
        }
    };

    document.getElementById('formNovoVet').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        try {
            const resultado = await api('/api/veterinarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: document.getElementById('vetNome').value,
                    email: document.getElementById('vetEmail').value,
                    senha: document.getElementById('vetSenha').value,
                    area_atuacao: document.getElementById('vetArea').value,
                    perfil: 'veterinario'
                })
            });
            alert(resultado.mensagem);
            evento.target.reset();
            carregarVeterinarios();
        } catch (erro) {
            alert('Erro: ' + erro.message);
        }
    });

    document.getElementById('buscaVet').addEventListener('keyup', (evento) => {
        const termo = evento.target.value.toLowerCase();
        renderizarVeterinarios(listaVets.filter(vet =>
            (vet.nome || '').toLowerCase().includes(termo) ||
            (vet.email || '').toLowerCase().includes(termo) ||
            (vet.area_atuacao || '').toLowerCase().includes(termo)
        ));
    });

    function preencherSelectVets() {

    const veterinarioLogadoId =
        usuario.veterinario_id;

    ['prontVet', 'recVet'].forEach(idSelect => {

        const select =
            document.getElementById(idSelect);

        if (!listaVets.length) {

            select.innerHTML =
                '<option value="">Nenhum veterinário cadastrado</option>';

            return;
        }

        select.innerHTML =
            listaVets
                .map(vet => {

                    const selecionado =
                        Number(vet.id) ===
                        Number(veterinarioLogadoId);

                    return `
                        <option
                            value="${vet.id}"
                            ${selecionado ? 'selected' : ''}
                        >
                            ${escapar(vet.nome)}
                            —
                            ${escapar(
                                vet.area_atuacao ||
                                'Clínica geral'
                            )}
                        </option>
                    `;

                })
                .join('');

        // Se for veterinário logado,
        // bloqueia alteração do responsável
        if (usuario.perfil === 'veterinario') {

            select.value =
                veterinarioLogadoId;

            select.disabled = true;

        }

    });

}

    // ---------- Pets (compartilhado entre prontuários, receitas e status) ----------
    let listaPets = [];

    async function carregarPets() {
        const tbody = document.getElementById('tabela-status');
        try {
            listaPets = await api('/api/pets');
            preencherSelectPets();
            renderizarStatus();
        } catch (erro) {
            console.error(erro);
            tbody.innerHTML = `<tr><td colspan="5" class="vazio" style="color:#d9534f;">${escapar(erro.message)}</td></tr>`;
        }
    }

    function preencherSelectPets() {
        ['prontPet', 'recPet'].forEach(idSelect => {
            const select = document.getElementById(idSelect);
            select.innerHTML = listaPets.length
                ? listaPets.map(pet => `<option value="${pet.id}">${escapar(pet.nome)} (${escapar(pet.especie || 'Pet')})</option>`).join('')
                : '<option value="">Nenhum pet cadastrado</option>';
        });
    }

    // ---------- RF-09: Status dos pets ----------
    const STATUS_PADRAO = ['Em espera', 'Em consulta', 'Em cirurgia', 'Em exames', 'Pronto para busca', 'Alta - Ativo'];

    function renderizarStatus() {
        const tbody = document.getElementById('tabela-status');
        if (!listaPets.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum pet cadastrado.</td></tr>';
            return;
        }
        tbody.innerHTML = listaPets.map(pet => `
            <tr>
                <td><strong>🐾 ${escapar(pet.nome)}</strong></td>
                <td>${escapar(pet.especie || '-')}</td>
                <td>${escapar(pet.nome_tutor || 'Sem tutor vinculado')}</td>
                <td><span class="status-badge-mini">${escapar(pet.status_atual || 'Em espera')}</span></td>
                <td>
                    <select class="select-status" onchange="atualizarStatus(${pet.id}, this.value)">
                        ${STATUS_PADRAO.map(status =>
                            `<option value="${status}" ${status === (pet.status_atual || 'Em espera') ? 'selected' : ''}>${status}</option>`
                        ).join('')}
                    </select>
                </td>
            </tr>
        `).join('');
    }

    window.atualizarStatus = async function (idPet, status) {
        try {
            const resultado = await api(`/api/animais/${idPet}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status_atual: status })
            });
            const pet = listaPets.find(p => p.id === idPet);
            if (pet) pet.status_atual = status;
            renderizarStatus();
            console.log(resultado.mensagem);
        } catch (erro) {
            alert('Erro ao atualizar status: ' + erro.message);
            carregarPets();
        }
    };

    // ---------- RF-07: Prontuários ----------
    async function carregarProntuarios() {
        const tbody = document.getElementById('tabela-prontuarios');
        try {
            const prontuarios = await api('/api/prontuarios');
            if (!prontuarios.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum prontuário registrado.</td></tr>';
                return;
            }
            tbody.innerHTML = prontuarios.map(p => `
                <tr>
                    <td>${formatarData(p.data_atendimento)}</td>
                    <td><strong>🐾 ${escapar(p.pet_nome)}</strong></td>
                    <td>${escapar(p.veterinario_nome)}</td>
                    <td>${escapar(p.queixa)}</td>
                    <td>${escapar(p.diagnostico || '-')}</td>
                    <td>${escapar(p.tratamento || '-')}</td>
                </tr>
            `).join('');
        } catch (erro) {
            console.error(erro);
            tbody.innerHTML = `<tr><td colspan="6" class="vazio" style="color:#d9534f;">${escapar(erro.message)}</td></tr>`;
        }
    }

    document.getElementById('formProntuario').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        try {
            const resultado = await api('/api/prontuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animal_id: document.getElementById('prontPet').value,
                    veterinario_id: document.getElementById('prontVet').value,
                    queixa: document.getElementById('prontQueixa').value,
                    diagnostico: document.getElementById('prontDiagnostico').value,
                    tratamento: document.getElementById('prontTratamento').value,
                    observacoes: document.getElementById('prontObs').value
                })
            });
            alert(resultado.mensagem);
            evento.target.reset();
            carregarProntuarios();
        } catch (erro) {
            alert('Erro: ' + erro.message);
        }
    });

    // ---------- RF-08: Receitas ----------
    async function carregarReceitas() {
        const tbody = document.getElementById('tabela-receitas');
        try {
            const receitas = await api('/api/receitas');
            if (!receitas.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhuma receita emitida.</td></tr>';
                return;
            }
            tbody.innerHTML = receitas.map(r => `
                <tr>
                    <td>${formatarData(r.emitida_em)}</td>
                    <td><strong>🐾 ${escapar(r.pet_nome)}</strong></td>
                    <td>${escapar(r.veterinario_nome)}</td>
                    <td>${escapar(r.medicamento)}</td>
                    <td>${escapar(r.posologia)}</td>
                    <td>${r.validade ? String(r.validade).slice(0, 10) : '-'}</td>
                </tr>
            `).join('');
        } catch (erro) {
            console.error(erro);
            tbody.innerHTML = `<tr><td colspan="6" class="vazio" style="color:#d9534f;">${escapar(erro.message)}</td></tr>`;
        }
    }

    document.getElementById('formReceita').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        try {
            const resultado = await api('/api/receitas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animal_id: document.getElementById('recPet').value,
                    veterinario_id: document.getElementById('recVet').value,
                    medicamento: document.getElementById('recMedicamento').value,
                    posologia: document.getElementById('recPosologia').value,
                    validade: document.getElementById('recValidade').value || null,
                    observacoes: document.getElementById('recObs').value
                })
            });
            alert(resultado.mensagem);
            evento.target.reset();
            carregarReceitas();
        } catch (erro) {
            alert('Erro: ' + erro.message);
        }
    });

    // ---------- Inicialização ----------
    document.addEventListener('DOMContentLoaded', () => {
        carregarVeterinarios();
        carregarPets();
        carregarProntuarios();
        carregarReceitas();
    });
})();
