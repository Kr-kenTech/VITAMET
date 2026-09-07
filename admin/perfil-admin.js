(() => {
    const dadosSalvos = localStorage.getItem('usuario') || localStorage.getItem('tutor');
    let usuario = {};

    try {
        usuario = dadosSalvos ? JSON.parse(dadosSalvos) : {};
    } catch (erro) {
        console.error('Erro ao carregar perfil administrativo:', erro);
    }

    const nome = usuario.nome || 'Administrador';
    const cargos = {
        admin: 'Admin',
        administrador: 'Admin',
        veterinario: 'Veterinário',
        vet: 'Veterinário',
        tutor: 'Tutor'
    };
    const perfil = String(usuario.perfil || '').toLowerCase().trim();
    const cargo = usuario.cargo || cargos[perfil] || 'Admin';
    const partesNome = nome.trim().split(/\s+/).filter(Boolean);
    const iniciais = partesNome.length > 1
        ? `${partesNome[0][0]}${partesNome[partesNome.length - 1][0]}`
        : (partesNome[0] || 'A').substring(0, 2);

    document.querySelectorAll('[data-admin-name]').forEach(elemento => {
        elemento.textContent = nome;
    });
    document.querySelectorAll('[data-admin-role]').forEach(elemento => {
        elemento.textContent = cargo;
    });
    document.querySelectorAll('[data-admin-initials]').forEach(elemento => {
        elemento.textContent = iniciais.toUpperCase();
    });
})();
