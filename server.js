const express = require('express');
const fs = require('fs');
const app = express();
const mysql = require('mysql2');
const path = require('path');
const argon2 = require('@node-rs/argon2');

// ==========================================
// CONEXÃO COM O BANCO
// ==========================================
const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Eddsworld!1',
    database: 'Vitamet',
    port: 3306
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.stack);
        return;
    }
    console.log('Conectado ao banco de dados Vitamet com sucesso como ID ' + connection.threadId);
});

// ==========================================
// PREPARAÇÃO DAS TABELAS (executa só uma vez)
// ==========================================
connection.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensagem TEXT NOT NULL,
        link VARCHAR(255) DEFAULT NULL,
        lida TINYINT(1) NOT NULL DEFAULT 0,
        data TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        agendada_para DATETIME DEFAULT NULL,
        chave_evento VARCHAR(180) DEFAULT NULL,
        PRIMARY KEY (id),
        KEY usuario_id (usuario_id),
        UNIQUE KEY chave_evento_unica (chave_evento),
        CONSTRAINT notificacoes_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS veterinario (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        area_atuacao VARCHAR(120) DEFAULT 'Clínica geral',
        ativo TINYINT(1) NOT NULL DEFAULT 0,
        cpf VARCHAR(14) NULL,
        cfmv VARCHAR(20) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY veterinario_usuario_unica (usuario_id),
        CONSTRAINT veterinario_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS relatorios (
        id INT NOT NULL AUTO_INCREMENT,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        periodo VARCHAR(100) NOT NULL,
        descricao TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'Concluído',
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS configuracoes_sistema (
        id INT NOT NULL AUTO_INCREMENT,
        chave VARCHAR(80) NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS denuncias_publicacoes (
        id INT NOT NULL AUTO_INCREMENT,
        publicacao_id INT NOT NULL,
        usuario_id INT NOT NULL,
        motivo VARCHAR(255) NOT NULL,
        data TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY denuncia_unica (publicacao_id, usuario_id),
        CONSTRAINT denuncias_publicacoes_ibfk_1 FOREIGN KEY (publicacao_id) REFERENCES publicacoes (id) ON DELETE CASCADE,
        CONSTRAINT denuncias_publicacoes_ibfk_2 FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS prontuarios (
        id INT NOT NULL AUTO_INCREMENT,
        animal_id INT NOT NULL,
        veterinario_id INT NOT NULL,
        consulta_id INT DEFAULT NULL,
        queixa TEXT NOT NULL,
        diagnostico TEXT,
        tratamento TEXT,
        observacoes TEXT,
        data_atendimento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY animal_id (animal_id),
        KEY veterinario_id (veterinario_id),
        CONSTRAINT prontuarios_animal_fk FOREIGN KEY (animal_id) REFERENCES animal(id) ON DELETE CASCADE,
        CONSTRAINT prontuarios_veterinario_fk FOREIGN KEY (veterinario_id) REFERENCES veterinario(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS receitas (
        id INT NOT NULL AUTO_INCREMENT,
        animal_id INT NOT NULL,
        veterinario_id INT NOT NULL,
        medicamento VARCHAR(180) NOT NULL,
        posologia TEXT NOT NULL,
        validade DATE DEFAULT NULL,
        observacoes TEXT,
        emitida_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT receitas_animal_fk FOREIGN KEY (animal_id) REFERENCES animal(id) ON DELETE CASCADE,
        CONSTRAINT receitas_veterinario_fk FOREIGN KEY (veterinario_id) REFERENCES veterinario(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

// Colunas extras (só adiciona se não existir)
connection.query('ALTER TABLE notificacoes ADD COLUMN agendada_para DATETIME DEFAULT NULL', () => {});
connection.query('ALTER TABLE notificacoes ADD COLUMN chave_evento VARCHAR(180) DEFAULT NULL', () => {});
connection.query('ALTER TABLE usuario ADD COLUMN banido TINYINT(1) NOT NULL DEFAULT 0', () => {});
connection.query('ALTER TABLE animal ADD COLUMN criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP', () => {});
connection.query('ALTER TABLE publicacoes ADD COLUMN oculta TINYINT(1) NOT NULL DEFAULT 0', () => {});

// Configurações padrão
connection.query(`
    INSERT IGNORE INTO configuracoes_sistema (chave, valor) VALUES
    ('razao_social', 'Clínica Veterinária Vitamed LTDA'),
    ('cnpj', '12.345.678/0001-90'),
    ('email_notificacoes', 'contato@vitamedvet.com.br'),
    ('alertas_estoque_baixo', '1'),
    ('autenticacao_2fa', '1'),
    ('notificacoes_consultas', '1'),
    ('ultimo_backup', 'Nunca')
`);

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function criarNotificacao(usuarioId, tipo, titulo, mensagem, link = null, agendadaPara = null, chaveEvento = null) {
    if (!usuarioId) return Promise.resolve();
    return connection.promise().query(
        `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, agendada_para, chave_evento)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [usuarioId, tipo, titulo, mensagem, link, agendadaPara, chaveEvento]
    );
}

function notificarTutores(tipo, titulo, mensagem, link = null) {
    return connection.promise().query(
        `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
         SELECT usuario_id, ?, ?, ?, ? FROM tutor`,
        [tipo, titulo, mensagem, link]
    );
}

function notificarAdministradores(tipo, titulo, mensagem, link = null) {
    return connection.promise().query(
        `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
         SELECT id, ?, ?, ?, ? FROM usuario WHERE perfil = 'admin'`,
        [tipo, titulo, mensagem, link]
    );
}

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.static(path.join(__dirname), { redirect: false }));

// ==========================================
// ROTAS DE PÁGINAS
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')))

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'inicio.html')));
app.get('/admin/:page', (req, res) => {
    const pagina = decodeURIComponent(req.params.page);
    res.sendFile(path.join(__dirname, 'admin', pagina));
});

// ==========================================
// AUTENTICAÇÃO
// ==========================================
app.get('/usuario/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.id, u.nome, u.email, u.perfil, t.cpf, t.telefone, t.endereco
        FROM usuario u
        LEFT JOIN tutor t ON t.usuario_id = u.id
        WHERE u.id = ?
    `;
    connection.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
        if (results.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        res.status(200).json(results[0]);
    });
});

app.post('/cadastro', async (req, res) => {
    const { nome, cpf, telefone, email, senha } = req.body;
    if (!nome || !cpf || !telefone || !email || !senha) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const [vetsComEmail] = await connection.promise().query(
        `SELECT u.id FROM usuario u JOIN veterinario v ON v.usuario_id = u.id WHERE u.email = ? LIMIT 1`,
        [emailNormalizado]
    );
    if (vetsComEmail.length) {
        return res.status(403).json({
            erro: 'Este e-mail pertence a um veterinário da clínica. O acesso deve ser liberado pelo administrador.'
        });
    }

    try {
        const senhaHash = await argon2.hash(senha);
        connection.query(
            'INSERT INTO usuario (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, 'tutor'],
            (err, results) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
                    return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
                }
                const usuarioId = results.insertId;
                connection.query(
                    'INSERT INTO tutor (usuario_id, nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?)',
                    [usuarioId, nome, cpf, telefone, email, ''],
                    (err2) => {
                        if (err2) {
                            if (err2.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'CPF ou e-mail já cadastrado.' });
                            return res.status(500).json({ erro: 'Erro ao cadastrar tutor.' });
                        }
                        res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });

    try {
        const [usuarios] = await connection.promise().query(
            `SELECT * FROM usuario WHERE email = ?`,
            [email.trim().toLowerCase()]
        );
        if (!usuarios.length) return res.status(401).json({ erro: 'E-mail ou senha incorretos!' });

        const usuario = usuarios[0];
        if (usuario.banido) return res.status(403).json({ erro: 'Este usuário foi banido.' });

        let senhaValida = false;
        if (usuario.senha && (usuario.senha.startsWith('$argon2') || usuario.senha.length > 50)) {
            senhaValida = await argon2.verify(usuario.senha, senha);
        } else {
            senhaValida = usuario.senha === senha;
        }
        if (!senhaValida) return res.status(401).json({ erro: 'E-mail ou senha incorretos!' });

        if (usuario.perfil === 'tutor') {
            const [tutores] = await connection.promise().query(`SELECT id FROM tutor WHERE usuario_id = ?`, [usuario.id]);
            return res.json({
                mensagem: 'Login realizado com sucesso!',
                usuario: {
                    id: usuario.id,
                    usuario_id: usuario.id,
                    tutor_id: tutores.length ? tutores[0].id : null,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: 'tutor'
                }
            });
        }

        if (usuario.perfil === 'veterinario' || usuario.perfil === 'vet') {
            const [veterinarios] = await connection.promise().query(
                `SELECT id, area_atuacao, ativo FROM veterinario WHERE usuario_id = ?`,
                [usuario.id]
            );
            if (!veterinarios.length || !veterinarios[0].ativo) {
                return res.status(403).json({
                    erro: 'Este e-mail não está na lista de veterinários da clínica. Solicite ao administrador a criação da sua conta no painel de Veterinários.'
                });
            }
            return res.json({
                mensagem: 'Login realizado com sucesso!',
                usuario: {
                    id: usuario.id,
                    usuario_id: usuario.id,
                    veterinario_id: veterinarios[0].id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: 'veterinario',
                    area_atuacao: veterinarios[0].area_atuacao
                }
            });
        }

        if (usuario.perfil === 'admin') {
            return res.json({
                mensagem: 'Login realizado com sucesso!',
                usuario: {
                    id: usuario.id,
                    usuario_id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: 'admin'
                }
            });
        }

        return res.status(403).json({ erro: 'Perfil de usuário inválido.' });
    } catch (erro) {
        console.error('Erro no login:', erro);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

app.post('/recuperar', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: 'E-mail é obrigatório.' });
    connection.query('SELECT * FROM usuario WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
        if (results.length === 0) return res.status(404).json({ erro: 'E-mail não encontrado!' });
        res.status(200).json({ mensagem: 'E-mail encontrado!' });
    });
});

// ==========================================
// NOTIFICAÇÕES
// ==========================================
async function verificarInatividade(usuarioId) {
    const [pets] = await connection.promise().query(
        `SELECT a.id, a.nome, MAX(c.data) AS ultima_consulta
         FROM animal a
         JOIN tutor t ON t.id = a.tutor_id
         LEFT JOIN consultas c ON c.pet_id = a.id
         WHERE t.usuario_id = ? AND a.criado_em <= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         GROUP BY a.id, a.nome`,
        [usuarioId]
    );
    const mesAtual = new Date().toISOString().slice(0, 7);

    for (const pet of pets) {
        if (!pet.ultima_consulta || new Date(pet.ultima_consulta) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
            await criarNotificacao(
                usuarioId,
                'inatividade_pet',
                `Acompanhamento de ${pet.nome}`,
                `Seu pet está há 3 meses sem comparecer à clínica. Verifique se está tudo bem com ele.`,
                'tutor.html',
                null,
                `inatividade:${pet.id}:${mesAtual}`
            );
        }
    }
}

app.get('/api/notificacoes', async (req, res) => {
    const { usuario_id } = req.query;
    if (!usuario_id) return res.status(400).json({ erro: 'O ID do usuário é obrigatório.' });

    try { await verificarInatividade(usuario_id); } catch (e) { console.error(e); }

    connection.query(
        `SELECT id, tipo, titulo, mensagem, link, lida, data
         FROM notificacoes
         WHERE usuario_id = ? AND (agendada_para IS NULL OR agendada_para <= NOW())
         ORDER BY lida ASC, data DESC LIMIT 30`,
        [usuario_id],
        (err, notificacoes) => {
            if (err) return res.status(500).json({ erro: 'Erro ao buscar notificações.' });
            res.json(notificacoes);
        }
    );
});

app.put('/api/notificacoes/:id/lida', (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;
    connection.query(
        'UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?',
        [id, usuario_id],
        (err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao marcar notificação.' });
            res.json({ mensagem: 'Notificação marcada como lida.' });
        }
    );
});

app.put('/api/notificacoes/lidas', (req, res) => {
    const { usuario_id } = req.body;
    connection.query(
        'UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?',
        [usuario_id],
        (err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao marcar notificações.' });
            res.json({ mensagem: 'Notificações marcadas como lidas.' });
        }
    );
});

// ==========================================
// ANIMAIS / PETS
// ==========================================
app.post('/api/animais', (req, res) => {
    const { usuario_id, nome, especie, raca, idade, sexo, peso, status_atual } = req.body;
    connection.query('SELECT id FROM tutor WHERE usuario_id = ?', [usuario_id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ erro: 'Tutor não encontrado para este usuário.' });
        const tutorId = results[0].id;
        connection.query(
            `INSERT INTO animal (tutor_id, nome, especie, raca, idade, sexo, peso, status_atual)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tutorId, nome, especie, raca, idade, sexo, peso, status_atual || 'Ativo'],
            (err2, resultAnimal) => {
                if (err2) return res.status(500).json({ erro: 'Erro ao cadastrar animal.' });
                res.status(201).json({ mensagem: 'Animal cadastrado com sucesso!', id: resultAnimal.insertId });
            }
        );
    });
});

app.get('/api/tutores', (req, res) => {
    connection.query('SELECT id, nome, cpf FROM tutor', (err, tutores) => {
        if (err) return res.status(500).json({ erro: 'Erro interno ao buscar tutores.' });
        res.json(tutores);
    });
});

app.get('/api/tutores/:tutorId/pets', (req, res) => {
    connection.query(
        `SELECT id, nome, especie, raca, idade, sexo, peso, status_atual FROM animal WHERE tutor_id = ?`,
        [req.params.tutorId],
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
            res.status(200).json(results);
        }
    );
});

// Rota de atualização de status (RF-09) + notificação ao tutor
app.put('/api/atualizar-status', async (req, res) => {
    const { pet_id, status } = req.body;
    if (!pet_id || !status) return res.status(400).json({ erro: 'ID do pet e status são obrigatórios.' });

    try {
        const [resultado] = await connection.promise().query(
            'UPDATE animal SET status_atual = ? WHERE id = ?',
            [status, pet_id]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ erro: 'Pet não encontrado.' });

        // Notifica o tutor
        const [dados] = await connection.promise().query(
            `SELECT a.nome AS pet_nome, t.usuario_id
             FROM animal a
             JOIN tutor t ON t.id = a.tutor_id
             WHERE a.id = ?`,
            [pet_id]
        );
        if (dados.length) {
            await criarNotificacao(
                dados[0].usuario_id,
                'status_pet',
                `Status de ${dados[0].pet_nome} atualizado`,
                `O status do seu pet na clínica foi alterado para: "${status}".`,
                'tutor.html'
            );
        }

        res.json({ mensagem: 'Status atualizado com sucesso!' });
    } catch (erro) {
        console.error('Erro ao atualizar status do pet:', erro);
        res.status(500).json({ erro: 'Erro interno ao atualizar status.' });
    }
});

app.get('/api/animais/tutor/:usuarioId', (req, res) => {
    connection.query(
        `SELECT a.id, a.nome, a.especie, a.raca, a.idade, a.sexo, a.peso, a.status_atual
         FROM animal a
         JOIN tutor t ON a.tutor_id = t.id
         WHERE t.usuario_id = ?`,
        [req.params.usuarioId],
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
            res.status(200).json(results);
        }
    );
});

app.post('/api/pets', (req, res) => {
    const { tutor_id, nome, especie, raca, idade, peso } = req.body;
    if (!tutor_id || !nome || !especie) return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });

    connection.query(
        `INSERT INTO animal (tutor_id, nome, especie, raca, idade, peso, status_atual)
         VALUES (?, ?, ?, ?, ?, ?, 'Ativo')`,
        [tutor_id, nome, especie, raca || '', idade || null, peso || null],
        (err, result) => {
            if (err) return res.status(500).json({ erro: 'Erro interno ao salvar pet no banco.' });
            res.status(201).json({ mensagem: 'Pet cadastrado com sucesso!', id: result.insertId });
        }
    );
});

app.get('/api/pets', (req, res) => {
    connection.query(
        `SELECT a.*, t.nome AS nome_tutor FROM animal a LEFT JOIN tutor t ON a.tutor_id = t.id`,
        (err, pets) => {
            if (err) return res.status(500).json({ erro: 'Erro interno ao buscar pets.' });
            res.json(pets);
        }
    );
});

app.delete('/api/animais/:id', (req, res) => {
    connection.query('DELETE FROM animal WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao excluir o animal do banco de dados.' });
        if (results.affectedRows === 0) return res.status(404).json({ erro: 'Animal não encontrado.' });
        res.status(200).json({ mensagem: 'Animal excluído com sucesso!' });
    });
});

// ==========================================
// CONSULTAS / AGENDAMENTOS
// ==========================================
app.post('/api/consultas', (req, res) => {
    const { animal_id, data, hora, tipo, observacoes, valor } = req.body;
    if (!animal_id || !data || !hora || !tipo) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios do agendamento.' });
    }

    connection.query(
        `SELECT t.id AS tutor_id, t.usuario_id
         FROM animal a JOIN tutor t ON a.tutor_id = t.id WHERE a.id = ?`,
        [animal_id],
        (err, resultsPet) => {
            if (err || resultsPet.length === 0) return res.status(404).json({ erro: 'Pet ou tutor não encontrado.' });

            const tutorId = resultsPet[0].tutor_id;
            const usuarioIdTutor = resultsPet[0].usuario_id;
            const obsText = observacoes || '';
            const valorConsulta = valor !== undefined ? valor : 0.00;

            connection.query(
                `INSERT INTO consultas (tutor_id, pet_id, servico, data, horario, observacoes, valor)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [tutorId, animal_id, tipo, data, hora, obsText, valorConsulta],
                (errInsert, results) => {
                    if (errInsert) {
                        if (errInsert.code === 'ER_DUP_ENTRY' || errInsert.errno === 1062) {
                            return res.status(400).json({ erro: 'Já existe uma consulta agendada para esta mesma data e horário!' });
                        }
                        return res.status(500).json({ erro: 'Erro ao salvar agendamento no banco.' });
                    }

                    criarNotificacao(
                        usuarioIdTutor,
                        'consulta',
                        'Consulta agendada',
                        `A consulta do seu pet foi agendada para ${data} às ${hora}.`,
                        'consultas.html'
                    ).catch(console.error);

                    const dataConsulta = new Date(`${data}T${hora}`);
                    const lembretes = [
                        { atraso: 24 * 60 * 60 * 1000, texto: 'Sua consulta acontece amanhã.', chave: '24h' },
                        { atraso: 2 * 60 * 60 * 1000, texto: 'Sua consulta acontece em 2 horas.', chave: '2h' },
                        { atraso: 10 * 60 * 1000, texto: 'Sua consulta começa em 10 minutos.', chave: '10min' }
                    ];
                    lembretes.forEach(lembrete => {
                        criarNotificacao(
                            usuarioIdTutor,
                            'lembrete_consulta',
                            'Lembrete de consulta',
                            `${lembrete.texto} Data: ${data} às ${hora}.`,
                            'consultas.html',
                            new Date(dataConsulta.getTime() - lembrete.atraso),
                            `consulta:${results.insertId}:lembrete:${lembrete.chave}`
                        ).catch(console.error);
                    });

                    res.status(201).json({ mensagem: 'Consulta agendada com sucesso!', id: results.insertId });
                }
            );
        }
    );
});

app.get('/api/agendamentos/tutor/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;
    connection.query(
        `SELECT c.id, a.nome AS pet, DATE_FORMAT(c.data, '%Y-%m-%d') AS data, c.servico, c.horario, c.observacoes, c.valor, 'Agendado' AS status
         FROM consultas c
         JOIN animal a ON c.pet_id = a.id
         JOIN tutor t ON c.tutor_id = t.id
         WHERE t.usuario_id = ?
         ORDER BY c.data ASC`,
        [usuarioId],
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
            res.status(200).json(results);
        }
    );
});

app.get('/api/gastos/:tutor_id', (req, res) => {
    const { tutor_id } = req.params;
    connection.query('SELECT SUM(valor) as totalGasto FROM consultas WHERE tutor_id = ?', [tutor_id], (err, resultTotal) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        connection.query(
            'SELECT servico as tipo_servico, SUM(valor) as total FROM consultas WHERE tutor_id = ? GROUP BY servico',
            [tutor_id],
            (err2, resultTipos) => {
                if (err2) return res.status(500).json({ erro: 'Erro no servidor' });
                res.status(200).json({
                    totalGasto: resultTotal[0].totalGasto || 0,
                    porTipo: resultTipos
                });
            }
        );
    });
});

app.delete('/api/agendamentos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Busca os dados da consulta antes de excluir
        const [consultas] = await connection.promise().query(
            `SELECT c.id, c.data, c.horario, c.servico,
                    a.nome AS pet_nome,
                    t.usuario_id
             FROM consultas c
             JOIN animal a ON a.id = c.pet_id
             JOIN tutor t ON t.id = c.tutor_id
             WHERE c.id = ?`,
            [id]
        );

        if (consultas.length === 0) {
            return res.status(404).json({ erro: 'Consulta não encontrada.' });
        }

        const consulta = consultas[0];

        // 2. Exclui a consulta
        const [resultado] = await connection.promise().query(
            'DELETE FROM consultas WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Consulta não encontrada.' });
        }

        // 3. Notifica o tutor
        const dataFormatada = new Date(consulta.data).toLocaleDateString('pt-BR');
        await criarNotificacao(
            consulta.usuario_id,
            'consulta_cancelada',
            'Consulta cancelada',
            `A consulta de ${consulta.pet_nome} marcada para ${dataFormatada} às ${consulta.horario} (${consulta.servico}) foi cancelada.`,
            'consultas.html'   // ou a página que o tutor usa para ver consultas
        );

        res.status(200).json({ mensagem: 'Consulta excluída com sucesso!' });

    } catch (erro) {
        console.error('Erro ao excluir consulta:', erro);
        res.status(500).json({ erro: 'Erro ao excluir a consulta.' });
    }
});

// ==========================================
// COMUNIDADE
// ==========================================
app.post('/api/publicacoes', (req, res) => {
    const { tutor_id, titulo, autor, iniciais, texto, conteudo, categoria } = req.body;
    const textoPublicacao = texto || conteudo;
    const ehPublicacaoAdmin = !tutor_id;

    if (!textoPublicacao || (!ehPublicacaoAdmin && !tutor_id)) {
        return res.status(400).json({ erro: 'O texto da publicação é obrigatório.' });
    }

    const tituloPublicacao = titulo || textoPublicacao;
    const autorPublicacao = autor || (ehPublicacaoAdmin ? 'VitaMet' : null);
    const iniciaisPublicacao = iniciais || (ehPublicacaoAdmin ? 'VM' : null);

    connection.query(
        `INSERT INTO publicacoes (tutor_id, titulo, autor, iniciais, texto, categoria)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tutor_id || null, tituloPublicacao, autorPublicacao, iniciaisPublicacao, textoPublicacao, categoria || 'Geral'],
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
            res.status(201).json({ id: results.insertId, mensagem: 'Publicação criada com sucesso!' });

            if (ehPublicacaoAdmin) {
                notificarTutores('publicacao_admin', 'Nova publicação da VitaMet', tituloPublicacao, 'comunidade.html')
                    .catch(console.error);
            }
        }
    );
});

app.get('/api/publicacoes', (req, res) => {
    const tutorIdFiltro = req.query.id || null;
    const modoAdmin = req.query.admin === '1' ? 1 : 0;

    const query = `
        SELECT p.id, p.tutor_id, p.categoria, p.titulo, p.autor, p.iniciais, p.texto, p.curtidas, p.data, p.oculta,
               u.id AS autor_usuario_id, u.nome AS autor_usuario_nome, u.banido AS autor_banido,
               (SELECT COUNT(*) FROM denuncias_publicacoes d WHERE d.publicacao_id = p.id) AS total_denuncias,
               EXISTS(
                   SELECT 1 FROM curtidas c2
                   JOIN tutor t2 ON t2.id = c2.tutor_id
                   WHERE c2.publicacao_id = p.id AND (c2.tutor_id = ? OR t2.usuario_id = ?)
               ) AS curtido,
               c.id AS comentario_id, c.tutor_id AS comentario_tutor_id, t.usuario_id AS comentario_usuario_id,
               c.texto AS comentario_texto, c.data AS comentario_data, t.nome AS comentario_autor
        FROM publicacoes p
        LEFT JOIN comentarios c ON c.publicacao_id = p.id
        LEFT JOIN tutor t ON t.id = c.tutor_id
        LEFT JOIN tutor autor_tutor ON autor_tutor.id = p.tutor_id
        LEFT JOIN usuario u ON u.id = autor_tutor.usuario_id
        WHERE (? = 1 OR p.oculta = 0)
        ORDER BY p.id DESC, c.id DESC
    `;

    connection.query(query, [tutorIdFiltro, tutorIdFiltro, modoAdmin], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno ao buscar publicações.' });

        const publicacoes = results.reduce((lista, linha) => {
            let publicacao = lista.find(item => item.id === linha.id);
            if (!publicacao) {
                publicacao = {
                    id: linha.id,
                    tutor_id: linha.tutor_id,
                    categoria: linha.categoria,
                    titulo: linha.titulo || linha.texto,
                    autor: linha.autor,
                    iniciais: linha.iniciais,
                    texto: linha.texto,
                    curtidas: linha.curtidas || 0,
                    curtido: Boolean(linha.curtido),
                    data: linha.data,
                    oculta: Boolean(linha.oculta),
                    autor_usuario_id: linha.autor_usuario_id,
                    autor_usuario_nome: linha.autor_usuario_nome,
                    autor_banido: Boolean(linha.autor_banido),
                    total_denuncias: Number(linha.total_denuncias || 0),
                    comentarios: []
                };
                lista.push(publicacao);
            }
            if (linha.comentario_id !== null) {
                publicacao.comentarios.push({
                    id: linha.comentario_id,
                    tutor_id: linha.comentario_tutor_id,
                    usuario_id: linha.comentario_usuario_id,
                    texto: linha.comentario_texto,
                    data: linha.comentario_data,
                    autor: linha.comentario_autor || 'Tutor'
                });
            }
            return lista;
        }, []);

        res.status(200).json(publicacoes);
    });
});

app.post('/api/publicacoes/:id/denunciar', async (req, res) => {
    const { usuario_id, motivo } = req.body;
    if (!usuario_id || !motivo) return res.status(400).json({ erro: 'Usuário e motivo da denúncia são obrigatórios.' });

    try {
        const [usuarios] = await connection.promise().query(
            'SELECT id FROM usuario WHERE id = ? UNION SELECT usuario_id AS id FROM tutor WHERE id = ? LIMIT 1',
            [usuario_id, usuario_id]
        );
        if (!usuarios.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        await connection.promise().query(
            `INSERT INTO denuncias_publicacoes (publicacao_id, usuario_id, motivo)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), data = CURRENT_TIMESTAMP`,
            [req.params.id, usuarios[0].id, motivo.trim()]
        );

        await notificarAdministradores(
            'denuncia',
            'Nova denúncia de publicação',
            `Uma publicação recebeu uma denúncia: ${motivo.trim()}`,
            'publicacoes.html'
        );
        res.status(201).json({ mensagem: 'Denúncia registrada e administradores notificados.' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao registrar denúncia.' });
    }
});

app.put('/api/moderacao/publicacoes/:id', async (req, res) => {
    const { oculta } = req.body;
    try {
        const [resultado] = await connection.promise().query(
            'UPDATE publicacoes SET oculta = ? WHERE id = ?',
            [oculta ? 1 : 0, req.params.id]
        );
        if (!resultado.affectedRows) return res.status(404).json({ erro: 'Publicação não encontrada.' });

        const [autores] = await connection.promise().query(
            `SELECT t.usuario_id FROM publicacoes p JOIN tutor t ON t.id = p.tutor_id WHERE p.id = ?`,
            [req.params.id]
        );
        if (autores.length) {
            await criarNotificacao(
                autores[0].usuario_id,
                oculta ? 'publicacao_ocultada' : 'publicacao_restaurada',
                oculta ? 'Publicação ocultada' : 'Publicação restaurada',
                oculta
                    ? 'Sua publicação foi ocultada pela administração após análise de uma denúncia.'
                    : 'Sua publicação foi restaurada pela administração.',
                'comunidade.html'
            );
        }
        res.json({ mensagem: oculta ? 'Publicação ocultada e autor notificado.' : 'Publicação restaurada e autor notificado.' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao alterar visibilidade da publicação.' });
    }
});

app.put('/api/moderacao/usuarios/:id/banir', (req, res) => {
    connection.query(
        `UPDATE usuario SET banido = 1 WHERE id = ? AND perfil <> 'admin'`,
        [req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ erro: 'Erro ao banir usuário.' });
            if (!result.affectedRows) return res.status(404).json({ erro: 'Usuário não encontrado ou não pode ser banido.' });
            res.json({ mensagem: 'Usuário banido com sucesso.' });
        }
    );
});

app.put('/api/publicacoes/:id/curtir', async (req, res) => {
    const publicacaoId = req.params.id;
    const { tutor_id, usuario_id } = req.body;
    const idEnviado = tutor_id || usuario_id;
    if (!idEnviado) return res.status(400).json({ erro: 'Identificação do tutor é obrigatória.' });

    try {
        const [tutores] = await connection.promise().query(
            'SELECT id FROM tutor WHERE id = ? OR usuario_id = ? LIMIT 1',
            [idEnviado, idEnviado]
        );
        if (tutores.length === 0) return res.status(404).json({ erro: 'Tutor não encontrado.' });
        const tutorIdReal = tutores[0].id;

        const [rows] = await connection.promise().query(
            'SELECT * FROM curtidas WHERE publicacao_id = ? AND tutor_id = ?',
            [publicacaoId, tutorIdReal]
        );

        if (rows.length > 0) {
            await connection.promise().query('DELETE FROM curtidas WHERE publicacao_id = ? AND tutor_id = ?', [publicacaoId, tutorIdReal]);
            await connection.promise().query('UPDATE publicacoes SET curtidas = GREATEST(curtidas - 1, 0) WHERE id = ?', [publicacaoId]);
            return res.status(200).json({ mensagem: 'Curtida removida', curtido: false });
        } else {
            await connection.promise().query('INSERT INTO curtidas (publicacao_id, tutor_id) VALUES (?, ?)', [publicacaoId, tutorIdReal]);
            await connection.promise().query('UPDATE publicacoes SET curtidas = curtidas + 1 WHERE id = ?', [publicacaoId]);

            const [publicacoes] = await connection.promise().query(
                `SELECT t.usuario_id FROM publicacoes p JOIN tutor t ON t.id = p.tutor_id
                 WHERE p.id = ? AND p.tutor_id <> ?`,
                [publicacaoId, tutorIdReal]
            );
            if (publicacoes.length > 0) {
                criarNotificacao(publicacoes[0].usuario_id, 'curtida', 'Seu post recebeu uma curtida', 'Alguém curtiu uma publicação sua.', 'comunidade.html')
                    .catch(console.error);
            }
            return res.status(200).json({ mensagem: 'Publicação curtida', curtido: true });
        }
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao processar curtida.' });
    }
});

app.get('/api/publicacoes/:id/comentarios', (req, res) => {
    connection.query(
        'SELECT id, publicacao_id, tutor_id, texto, data FROM comentarios WHERE publicacao_id = ? ORDER BY id DESC',
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno ao buscar comentários.' });
            res.status(200).json(results);
        }
    );
});

app.post('/api/publicacoes/:id/comentarios', (req, res) => {
    const publicacaoId = req.params.id;
    const { tutor_id, usuario_id, texto } = req.body;
    if (!texto) return res.status(400).json({ erro: 'O texto do comentário não pode estar vazio.' });

    const idEnviado = tutor_id || usuario_id;
    if (!idEnviado) return res.status(400).json({ erro: 'Identificação do tutor é obrigatória.' });

    const salvarNoBanco = (idTutorReal) => {
        connection.query(
            'INSERT INTO comentarios (publicacao_id, tutor_id, texto, data) VALUES (?, ?, ?, NOW())',
            [publicacaoId, idTutorReal, texto],
            (err, result) => {
                if (err) return res.status(500).json({ erro: 'Erro interno ao salvar comentário.' });

                connection.query(
                    `SELECT t.usuario_id FROM publicacoes p JOIN tutor t ON t.id = p.tutor_id
                     WHERE p.id = ? AND p.tutor_id <> ?`,
                    [publicacaoId, idTutorReal],
                    (erroNotificacao, publicacoes) => {
                        if (!erroNotificacao && publicacoes.length > 0) {
                            criarNotificacao(
                                publicacoes[0].usuario_id,
                                'comentario',
                                'Seu post recebeu um comentário',
                                'Alguém comentou em uma publicação sua.',
                                'comunidade.html'
                            ).catch(console.error);
                        }
                    }
                );
                res.status(201).json({ mensagem: 'Comentário adicionado com sucesso!', id: result.insertId });
            }
        );
    };

    connection.query('SELECT id FROM tutor WHERE id = ?', [idEnviado], (err, resultsTutor) => {
        if (err) return res.status(500).json({ erro: 'Erro ao verificar tutor.' });
        if (resultsTutor.length > 0) return salvarNoBanco(resultsTutor[0].id);

        connection.query('SELECT id FROM tutor WHERE usuario_id = ?', [idEnviado], (err2, resultsUsuario) => {
            if (err2 || resultsUsuario.length === 0) {
                return res.status(400).json({ erro: 'O tutor associado a este usuário não foi encontrado no banco de dados.' });
            }
            salvarNoBanco(resultsUsuario[0].id);
        });
    });
});

app.delete('/api/publicacoes/:id', (req, res) => {
    connection.query('DELETE FROM publicacoes WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
        res.status(200).json({ mensagem: 'Publicação excluída com sucesso!' });
    });
});

app.delete('/api/comentarios/:id', async (req, res) => {
    try {
        await connection.promise().query('DELETE FROM comentarios WHERE id = ?', [req.params.id]);
        res.status(200).json({ mensagem: 'Comentário excluído com sucesso!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao excluir comentário.' });
    }
});


app.get('/api/tipos-servicos', (req, res) => {
    connection.query('SELECT * FROM tipos_servicos', (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        res.status(200).json(results);
    });
});

// ==========================================
// DASHBOARD ADMIN
// ==========================================
app.get('/api/dashboard/estatisticas', async (req, res) => {
    try {
        const [tutoresRes] = await connection.promise().query('SELECT COUNT(*) AS total FROM tutor');
        const [petsRes] = await connection.promise().query('SELECT COUNT(*) AS total FROM animal');
        const [vetsRes] = await connection.promise().query(`SELECT COUNT(*) AS total FROM usuario WHERE perfil IN ('veterinario', 'vet')`);
        const [prontuariosRes] = await connection.promise().query('SELECT COUNT(*) AS total FROM consultas');

        res.status(200).json({
            totalTutores: tutoresRes[0].total || 0,
            totalPets: petsRes[0].total || 0,
            totalVets: vetsRes[0].total || 0,
            totalProntuarios: prontuariosRes[0].total || 0
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro interno ao buscar estatísticas.' });
    }
});

// ==========================================
// RELATÓRIOS
// ==========================================
app.get('/api/relatorios', async (req, res) => {
    try {
        const periodo = String(req.query.periodo || '').trim();
        const periodoValido = /^\d{4}-\d{2}$/.test(periodo);
        const filtroData = periodoValido
            ? 'data >= ? AND data < DATE_ADD(?, INTERVAL 1 MONTH)'
            : 'YEAR(data) = YEAR(CURDATE()) AND MONTH(data) = MONTH(CURDATE())';
        const parametrosData = periodoValido ? [`${periodo}-01`, `${periodo}-01`] : [];

        const [faturamentoRes] = await connection.promise().query(
            `SELECT COALESCE(SUM(valor), 0) AS total FROM consultas WHERE ${filtroData}`,
            parametrosData
        );
        const [consultasRes] = await connection.promise().query(
            `SELECT COUNT(*) AS total FROM consultas WHERE ${filtroData}`,
            parametrosData
        );
        const [vacinasRes] = await connection.promise().query(
            `SELECT COUNT(*) AS total FROM consultas WHERE ${filtroData} AND LOWER(servico) LIKE '%vacina%'`,
            parametrosData
        );
        const [estoqueRes] = await connection.promise().query(
            'SELECT COALESCE(SUM(quantidade * custo), 0) AS total FROM logistica'
        );
        const [relatoriosSalvos] = await connection.promise().query(
            `SELECT id, nome, tipo, periodo, descricao, status, criado_em, atualizado_em
             FROM relatorios ${periodoValido ? 'WHERE periodo = ?' : ''}
             ORDER BY atualizado_em DESC`,
            periodoValido ? [periodo] : []
        );

        res.json({
            indicadores: {
                faturamentoMes: Number(faturamentoRes[0].total || 0),
                consultasRealizadas: Number(consultasRes[0].total || 0),
                vacinasRealizadas: Number(vacinasRes[0].total || 0),
                valorEstoque: Number(estoqueRes[0].total || 0)
            },
            relatorios: relatoriosSalvos.map(r => ({ ...r, origem: 'salvo', data: r.atualizado_em, valor: null }))
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar dados dos relatórios.' });
    }
});

app.post('/api/relatorios', (req, res) => {
    const { nome, tipo, periodo, descricao } = req.body;
    if (!nome || !tipo || !periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
        return res.status(400).json({ erro: 'Nome, tipo e um período válido de mês e ano são obrigatórios.' });
    }
    connection.query(
        `INSERT INTO relatorios (nome, tipo, periodo, descricao, status) VALUES (?, ?, ?, ?, 'Concluído')`,
        [nome.trim(), tipo.trim(), periodo.trim(), (descricao || '').trim()],
        (err, result) => {
            if (err) return res.status(500).json({ erro: 'Erro ao salvar o relatório.' });
            res.status(201).json({ id: result.insertId, mensagem: 'Relatório gerado com sucesso.' });
        }
    );
});

app.put('/api/relatorios/:id', (req, res) => {
    const { nome, tipo, periodo, descricao, status } = req.body;
    if (!nome || !tipo || !periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
        return res.status(400).json({ erro: 'Nome, tipo e um período válido de mês e ano são obrigatórios.' });
    }
    connection.query(
        `UPDATE relatorios SET nome = ?, tipo = ?, periodo = ?, descricao = ?, status = ? WHERE id = ?`,
        [nome.trim(), tipo.trim(), periodo.trim(), (descricao || '').trim(), status || 'Concluído', req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ erro: 'Erro ao alterar o relatório.' });
            if (!result.affectedRows) return res.status(404).json({ erro: 'Relatório não encontrado.' });
            res.json({ mensagem: 'Relatório alterado com sucesso.' });
        }
    );
});

app.delete('/api/relatorios/:id', (req, res) => {
    connection.query('DELETE FROM relatorios WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ erro: 'Erro ao excluir o relatório.' });
        if (!result.affectedRows) return res.status(404).json({ erro: 'Relatório não encontrado.' });
        res.json({ mensagem: 'Relatório excluído com sucesso.' });
    });
});

// ==========================================
// VETERINÁRIOS
// ==========================================
app.get('/api/veterinarios', (req, res) => {
    connection.query(
        `SELECT v.id, v.usuario_id, u.nome, u.email, u.perfil, v.area_atuacao
         FROM veterinario v
         INNER JOIN usuario u ON u.id = v.usuario_id
         WHERE u.perfil IN ('veterinario', 'vet')
         ORDER BY u.nome ASC`,
        (err, results) => {
            if (err) return res.status(500).json({ erro: 'Erro interno ao buscar veterinários.' });
            res.status(200).json(results);
        }
    );
});

app.post('/api/veterinarios', async (req, res) => {
    const { nome, email, senha, area_atuacao } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });

    try {
        const [usuariosExistentes] = await connection.promise().query('SELECT id FROM usuario WHERE email = ?', [email]);
        if (usuariosExistentes.length > 0) return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });

        const senhaHash = await argon2.hash(senha);
        const [resultadoUsuario] = await connection.promise().query(
            `INSERT INTO usuario (nome, email, senha, perfil) VALUES (?, ?, ?, 'veterinario')`,
            [nome.trim(), email.trim().toLowerCase(), senhaHash]
        );
        const usuarioId = resultadoUsuario.insertId;

        const [resultadoVeterinario] = await connection.promise().query(
            `INSERT INTO veterinario (usuario_id, area_atuacao, ativo) VALUES (?, ?, 1)`,
            [usuarioId, area_atuacao || 'Clínica geral']
        );

        await notificarAdministradores(
            'novo_veterinario',
            'Novo veterinário cadastrado',
            `${nome} foi adicionado ao corpo clínico.`,
            '/admin/veterinarios.html'
        );

        res.status(201).json({
            mensagem: 'Veterinário cadastrado com sucesso!',
            veterinario: {
                id: resultadoVeterinario.insertId,
                usuario_id: usuarioId,
                nome: nome.trim(),
                email: email.trim().toLowerCase(),
                perfil: 'veterinario',
                area_atuacao: area_atuacao || 'Clínica geral'
            }
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao cadastrar veterinário.' });
    }
});

app.put('/api/veterinarios/:id/area', (req, res) => {
    const { area_atuacao } = req.body;
    if (!area_atuacao) return res.status(400).json({ erro: 'A área de atuação é obrigatória.' });

    connection.query(
        `INSERT INTO veterinario (usuario_id, area_atuacao, ativo)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE area_atuacao = VALUES(area_atuacao), ativo = 1`,
        [req.params.id, area_atuacao.trim()],
        (err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao atualizar área de atuação.' });
            res.json({ mensagem: 'Área de atuação atualizada.' });
        }
    );
});

// ==========================================
// USUÁRIOS
// ==========================================
app.get('/api/usuarios', (req, res) => {
    connection.query(`SELECT id, nome, email, perfil FROM usuario WHERE perfil != 'admin'`, (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno ao buscar usuários.' });
        res.status(200).json(results);
    });
});

app.delete('/api/usuarios/:id', (req, res) => {
    connection.query('DELETE FROM usuario WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao excluir usuário.' });
        if (results.affectedRows === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        res.status(200).json({ mensagem: 'Usuário excluído com sucesso!' });
    });
});

// ==========================================
// LOGÍSTICA
// ==========================================
app.get('/api/logistica', (req, res) => {
    connection.query('SELECT * FROM logistica ORDER BY id DESC', (err, results) => {
        if (err) return res.status(200).json([]);
        res.status(200).json(results);
    });
});

app.post('/api/logistica', (req, res) => {
    const { sku, nome, categoria, quantidade, custo, status } = req.body;

    if (!sku || !nome || !quantidade) {
        return res.status(400).json({ erro: 'SKU, Nome e Quantidade são obrigatórios.' });
    }

    connection.query(
        `INSERT INTO logistica (sku, nome, categoria, quantidade, custo, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sku, nome, categoria || 'Geral', quantidade, custo || 0.00, status || 'Normal'],
        (err, result) => {
            if (err) {
                // SKU duplicado
                if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                    return res.status(400).json({
                        erro: `Já existe um item cadastrado com o SKU "${sku}". Use outro código.`
                    });
                }
                console.error('Erro ao cadastrar item de logística:', err);
                return res.status(500).json({ erro: 'Erro interno ao salvar item no estoque.' });
            }

            res.status(201).json({
                mensagem: 'Item cadastrado com sucesso!',
                id: result.insertId
            });
        }
    );
});

app.put('/api/logistica/:id', (req, res) => {
    const { id } = req.params;
    const { sku, nome, categoria, quantidade, custo, status } = req.body;

    if (!sku || !nome || quantidade === undefined || quantidade === null) {
        return res.status(400).json({ erro: 'SKU, Nome e Quantidade são obrigatórios.' });
    }

    connection.query(
        `UPDATE logistica
         SET sku = ?, nome = ?, categoria = ?, quantidade = ?, custo = ?, status = ?
         WHERE id = ?`,
        [sku, nome, categoria || 'Geral', quantidade, custo || 0.00, status || 'Normal', id],
        (err, result) => {
            if (err) {
                // SKU duplicado
                if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                    return res.status(400).json({
                        erro: `Já existe outro item com o SKU "${sku}". Escolha um código diferente.`
                    });
                }
                console.error('Erro ao alterar item de logística:', err);
                return res.status(500).json({ erro: 'Erro interno ao alterar o item no estoque.' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ erro: 'Item não encontrado.' });
            }

            res.status(200).json({ mensagem: 'Item alterado com sucesso!' });
        }
    );
});

app.delete('/api/logistica/:id', (req, res) => {
    connection.query('DELETE FROM logistica WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ erro: 'Erro interno ao excluir o item do estoque.' });
        if (result.affectedRows === 0) return res.status(404).json({ erro: 'Item não encontrado.' });
        res.status(200).json({ mensagem: 'Item excluído com sucesso!' });
    });
});

app.get('/api/pedidos', (req, res) => {
    connection.query('SELECT * FROM pedidos_compra ORDER BY id DESC', (err, results) => {
        if (err) return res.status(200).json([]);
        res.status(200).json(results);
    });
});

app.get('/api/logistica/estatisticas', async (req, res) => {
    try {
        const [totalItensRes] = await connection.promise().query('SELECT COALESCE(SUM(quantidade), 0) AS total FROM logistica');
        const [valorEstoqueRes] = await connection.promise().query('SELECT COALESCE(SUM(quantidade * custo), 0) AS valor_total FROM logistica');
        const [criticosRes] = await connection.promise().query(`SELECT COUNT(*) AS total FROM logistica WHERE status LIKE '%crítico%'`);
        const [pedidosRes] = await connection.promise().query('SELECT COUNT(*) AS total FROM pedidos_compra');

        res.status(200).json({
            totalItens: totalItensRes[0].total,
            valorEstoque: valorEstoqueRes[0].valor_total,
            itensCriticos: criticosRes[0].total,
            totalPedidos: pedidosRes[0].total
        });
    } catch (err) {
        res.status(200).json({ totalItens: 0, valorEstoque: 0, itensCriticos: 0, totalPedidos: 0 });
    }
});

// ==========================================
// PRONTUÁRIOS E RECEITAS (Veterinário + Tutor)
// ==========================================

// Lista prontuários (com filtros opcionais)
app.get('/api/prontuarios', async (req, res) => {
    try {
        const filtros = [];
        const parametros = [];
        if (req.query.animal_id) {
            filtros.push('p.animal_id = ?');
            parametros.push(req.query.animal_id);
        }
        if (req.query.veterinario_id) {
            filtros.push('p.veterinario_id = ?');
            parametros.push(req.query.veterinario_id);
        }

        const [prontuarios] = await connection.promise().query(
            `SELECT p.*, a.nome AS pet_nome, a.especie, u.nome AS veterinario_nome
             FROM prontuarios p
             JOIN animal a ON a.id = p.animal_id
             JOIN veterinario v ON v.id = p.veterinario_id
             JOIN usuario u ON u.id = v.usuario_id
             ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
             ORDER BY p.data_atendimento DESC
             LIMIT 100`,
            parametros
        );
        res.json(prontuarios);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar prontuários.' });
    }
});

// NOVA ROTA: Prontuários visíveis para o tutor
app.get('/api/prontuarios/tutor/:usuarioId', async (req, res) => {
    try {
        const [prontuarios] = await connection.promise().query(
            `SELECT 
                p.id, p.queixa, p.diagnostico, p.tratamento, p.observacoes, p.data_atendimento,
                a.nome AS pet_nome, a.especie,
                u.nome AS veterinario_nome
             FROM prontuarios p
             JOIN animal a ON a.id = p.animal_id
             JOIN tutor t ON t.id = a.tutor_id
             JOIN veterinario v ON v.id = p.veterinario_id
             JOIN usuario u ON u.id = v.usuario_id
             WHERE t.usuario_id = ?
             ORDER BY p.data_atendimento DESC`,
            [req.params.usuarioId]
        );
        res.json(prontuarios);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar prontuários do tutor.' });
    }
});

app.post('/api/prontuarios', async (req, res) => {
    const { animal_id, veterinario_id, queixa, diagnostico, tratamento, observacoes } = req.body;
    if (!animal_id || !veterinario_id || !queixa) {
        return res.status(400).json({ erro: 'Pet, veterinário e queixa são obrigatórios.' });
    }

    try {
        const [result] = await connection.promise().query(
            `INSERT INTO prontuarios (animal_id, veterinario_id, queixa, diagnostico, tratamento, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [animal_id, veterinario_id, queixa.trim(), diagnostico || null, tratamento || null, observacoes || null]
        );

        const [dados] = await connection.promise().query(
            `SELECT a.nome AS pet_nome, t.usuario_id AS tutor_usuario_id, u.nome AS veterinario_nome
             FROM animal a
             JOIN tutor t ON t.id = a.tutor_id
             JOIN veterinario v ON v.id = ?
             JOIN usuario u ON u.id = v.usuario_id
             WHERE a.id = ?`,
            [veterinario_id, animal_id]
        );

        if (dados.length) {
            await criarNotificacao(
                dados[0].tutor_usuario_id,
                'prontuario',
                'Novo atendimento registrado',
                `Um novo atendimento de ${dados[0].pet_nome} foi registrado por ${dados[0].veterinario_nome}.`,
                'dashboard.html'
            );
            await notificarAdministradores(
                'novo_prontuario',
                'Novo atendimento clínico',
                `${dados[0].veterinario_nome} registrou um atendimento para ${dados[0].pet_nome}.`,
                '/admin/pets.html'
            );
        }

        res.status(201).json({ mensagem: 'Prontuário registrado com sucesso!', id: result.insertId });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao registrar prontuário.' });
    }
});

// Lista todas as receitas
app.get('/api/receitas', async (req, res) => {
    try {
        const [receitas] = await connection.promise().query(
            `SELECT r.*, a.nome AS pet_nome, u.nome AS veterinario_nome
             FROM receitas r
             JOIN animal a ON a.id = r.animal_id
             JOIN veterinario v ON v.id = r.veterinario_id
             JOIN usuario u ON u.id = v.usuario_id
             ORDER BY r.emitida_em DESC
             LIMIT 100`
        );
        res.json(receitas);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar receitas.' });
    }
});

// NOVA ROTA: Receitas visíveis para o tutor
app.get('/api/receitas/tutor/:usuarioId', async (req, res) => {
    try {
        const [receitas] = await connection.promise().query(
            `SELECT 
                r.id, r.medicamento, r.posologia, r.validade, r.observacoes, r.emitida_em,
                a.nome AS pet_nome, a.especie,
                u.nome AS veterinario_nome
             FROM receitas r
             JOIN animal a ON a.id = r.animal_id
             JOIN tutor t ON t.id = a.tutor_id
             JOIN veterinario v ON v.id = r.veterinario_id
             JOIN usuario u ON u.id = v.usuario_id
             WHERE t.usuario_id = ?
             ORDER BY r.emitida_em DESC`,
            [req.params.usuarioId]
        );
        res.json(receitas);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar receitas do tutor.' });
    }
});

app.post('/api/receitas', async (req, res) => {
    const { animal_id, veterinario_id, medicamento, posologia, validade, observacoes } = req.body;
    if (!animal_id || !veterinario_id || !medicamento || !posologia) {
        return res.status(400).json({ erro: 'Pet, veterinário, medicamento e posologia são obrigatórios.' });
    }

    try {
        const [result] = await connection.promise().query(
            `INSERT INTO receitas (animal_id, veterinario_id, medicamento, posologia, validade, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [animal_id, veterinario_id, medicamento.trim(), posologia.trim(), validade || null, observacoes || null]
        );

        const [dados] = await connection.promise().query(
            `SELECT a.nome AS pet_nome, t.usuario_id AS tutor_usuario_id, u.nome AS veterinario_nome
             FROM animal a
             JOIN tutor t ON t.id = a.tutor_id
             JOIN veterinario v ON v.id = ?
             JOIN usuario u ON u.id = v.usuario_id
             WHERE a.id = ?`,
            [veterinario_id, animal_id]
        );

        if (dados.length) {
            await criarNotificacao(
                dados[0].tutor_usuario_id,
                'receita',
                'Nova receita emitida',
                `${dados[0].veterinario_nome} emitiu uma nova receita para ${dados[0].pet_nome}.`,
                'dashboard.html'
            );
            await notificarAdministradores(
                'nova_receita',
                'Nova receita veterinária',
                `${dados[0].veterinario_nome} emitiu uma receita para ${dados[0].pet_nome}.`,
                '/admin/pets.html'
            );
        }

        res.status(201).json({ mensagem: 'Receita emitida com sucesso!', id: result.insertId });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao emitir receita.' });
    }
});

// ==========================================
// REDEFINIR SENHA
// ==========================================
app.post('/api/redefinir-senha', async (req, res) => {
    const { email, novaSenha } = req.body;

    if (!email || !novaSenha) {
        return res.status(400).json({ erro: 'E-mail e nova senha são obrigatórios.' });
    }

    if (novaSenha.length < 6) {
        return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        const senhaHash = await argon2.hash(novaSenha);

        const [resultado] = await connection.promise().query(
            'UPDATE usuario SET senha = ? WHERE email = ?',
            [senhaHash, email.trim().toLowerCase()]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'E-mail não encontrado.' });
        }

        res.json({ mensagem: 'Senha redefinida com sucesso!' });
    } catch (erro) {
        console.error('Erro ao redefinir senha:', erro);
        res.status(500).json({ erro: 'Erro interno ao redefinir senha.' });
    }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000 em http://localhost:3000');
});