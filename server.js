const express = require('express');
const app = express();
const mysql = require('mysql2');
const path = require('path');
const argon2 = require('@node-rs/argon2');

// Conexão com o banco de dados
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

// Middleware para JSON
app.use(express.json());

// Servir arquivos estáticos da pasta atual
app.use(express.static(path.join(__dirname)));

// Rotas para as páginas principais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
});

app.get('/tutor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'tutor.html'));
});

// Rota de Usuário por ID (para preencher o painel)
app.get('/usuario/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT id, nome, email, perfil FROM usuario WHERE id = ?';

    connection.query(query, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        return res.status(200).json(results[0]);
    });
});

// Rota de Cadastro
app.post('/cadastro', async (req, res) => {
    const { nome, cpf, telefone, email, senha } = req.body;

    if (!nome || !cpf || !telefone || !email || !senha) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }

    try {
        const senhaHash = await argon2.hash(senha, {
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 2,
        });

        const queryUsuario = 'INSERT INTO usuario (nome, email, senha, perfil) VALUES (?, ?, ?, ?)';
        connection.query(queryUsuario, [nome, email, senhaHash, 'tutor'], (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
                }
                console.error("Erro no MySQL (usuario):", err);
                return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
            }

            const usuarioId = results.insertId;

            const queryTutor = 'INSERT INTO tutor (usuario_id, nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?)';
            connection.query(queryTutor, [usuarioId, nome, cpf, telefone, email, ''], (err2) => {
                if (err2) {
                    if (err2.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ erro: 'CPF ou e-mail já cadastrado.' });
                    }
                    console.error("Erro no MySQL (tutor):", err2);
                    return res.status(500).json({ erro: 'Erro ao cadastrar tutor.' });
                }

                return res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
            });
        });
    } catch (error) {
        console.error("Erro detalhado no cadastro:", error);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

// Rota de Login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    const query = 'SELECT * FROM usuario WHERE email = ?';

    connection.query(query, [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const usuario = results[0];

        try {
            const senhaCorreta = await argon2.verify(usuario.senha, senha);
            
            if (!senhaCorreta) {
                return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
            }

            return res.status(200).json({
                mensagem: 'Login realizado com sucesso!',
                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: usuario.perfil
                }
            });
        } catch (error) {
            console.error("Erro detalhado no login:", error);
            return res.status(401).json({ erro: 'Erro ao verificar senha.' });
        }
    });
});

// Rota de Recuperação de Senha
app.post('/recuperar', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ erro: 'E-mail é obrigatório.' });
    }

    const query = 'SELECT * FROM usuario WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ erro: 'E-mail não encontrado!' });
        }

        return res.status(200).json({ mensagem: 'E-mail encontrado!' });
    });
});

// ==========================================
// ROTAS DE ANIMAIS (PETS)
// ==========================================

// Cadastrar novo animal vinculado ao tutor
app.post('/api/animais', (req, res) => {
    const { usuario_id, nome, especie, raca, idade, sexo, peso, status_atual } = req.body;

    const queryTutor = 'SELECT id FROM tutor WHERE usuario_id = ?';
    connection.query(queryTutor, [usuario_id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ erro: 'Tutor não encontrado para este usuário.' });
        }

        const tutorId = results[0].id;

        const queryAnimal = `
            INSERT INTO animal (tutor_id, nome, especie, raca, idade, sexo, peso, status_atual) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        connection.query(queryAnimal, [tutorId, nome, especie, raca, idade, sexo, peso, status_atual || 'Ativo'], (err2, resultAnimal) => {
            if (err2) {
                console.error("Erro ao salvar animal:", err2);
                return res.status(500).json({ erro: 'Erro ao cadastrar animal.' });
            }
            return res.status(201).json({ mensagem: 'Animal cadastrado com sucesso!', id: resultAnimal.insertId });
        });
    });
});

// Listar pets do tutor
app.get('/api/animais/tutor/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const query = `
        SELECT a.id, a.nome, a.especie, a.raca, a.idade, a.sexo, a.peso, a.status_atual
        FROM animal a
        JOIN tutor t ON a.tutor_id = t.id
        WHERE t.usuario_id = ?
    `;

    connection.query(query, [usuarioId], (err, results) => {
        if (err) {
            console.error("Erro ao buscar animais:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        return res.status(200).json(results);
    });
});

// ==========================================
// ROTAS DE AGENDAMENTOS E CONSULTAS
// ==========================================

// Cadastrar nova consulta
app.post('/api/agendamentos', (req, res) => {
    const { animal_id, veterinario_id, data, hora, tipo, status } = req.body;

    if (!animal_id || !data || !hora || !tipo) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios do agendamento.' });
    }

    const query = `INSERT INTO consulta (animal_id, veterinario_id, data, hora, tipo, status) VALUES (?, ?, ?, ?, ?, ?)`;
    const vetId = veterinario_id || 1; 
    const statusConsulta = status || 'Agendado';

    connection.query(query, [animal_id, vetId, data, hora, tipo, statusConsulta], (err, results) => {
        if (err) {
            console.error("Erro ao salvar consulta:", err);
            return res.status(500).json({ erro: 'Erro ao salvar agendamento no banco.' });
        }
        return res.status(201).json({ mensagem: 'Consulta agendada com sucesso!', id: results.insertId });
    });
});

// Listar consultas vinculadas ao tutor logado
app.get('/api/agendamentos/tutor/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const query = `
        SELECT c.id, a.nome AS pet, c.tipo AS servico, c.data, c.hora, c.status 
        FROM consulta c
        JOIN animal a ON c.animal_id = a.id
        JOIN tutor t ON a.tutor_id = t.id
        WHERE t.usuario_id = ?
    `;

    connection.query(query, [usuarioId], (err, results) => {
        if (err) {
            console.error("Erro ao buscar agendamentos:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        return res.status(200).json(results);
    });
});

app.post('/api/consultas', (req, res) => {
    const { animal_id, veterinario_id, data, hora, tipo, status, observacoes } = req.body;

    if (!animal_id || !data || !hora || !tipo) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios do agendamento.' });
    }

    // Altere para 'consultas' ou 'consulta' conforme o nome real da tabela no seu MySQL
    const query = `INSERT INTO consultas (animal_id, veterinario_id, data, hora, tipo, status, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const vetId = veterinario_id || 1; 
    const statusConsulta = status || 'Agendado';
    const obsText = observacoes || '';

    connection.query(query, [animal_id, vetId, data, hora, tipo, statusConsulta, obsText], (err, results) => {
        if (err) {
            console.error("Erro detalhado ao salvar consulta no MySQL:", err);
            return res.status(500).json({ erro: 'Erro ao salvar agendamento no banco.' });
        }
        return res.status(201).json({ mensagem: 'Consulta agendada com sucesso!', id: results.insertId });
    });
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000 em http://localhost:3000');
});