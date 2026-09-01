const express = require('express');
const app = express();
const mysql = require('mysql2');
const path = require('path');
const argon2 = require('argon2-browser');

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

app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'Login')));
app.use('/Dashboard', express.static(path.join(__dirname, 'Login', 'Dashboard')));

// Rotas para as páginas principais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Login', 'login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Login', 'Cadastro', 'cadastro.html'));
});

app.get('/tutor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Login', 'Dashboard', 'tutor.html'));
});

// Rota de Cadastro
app.post('/cadastro', async (req, res) => {
    const { nome, cpf, telefone, email, senha } = req.body;

    if (!nome || !cpf || !telefone || !email || !senha) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }

    try {
        const senhaHash = await argon2.hash(senha, {
            type: argon2.argon2id,
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
                return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
            }

            const usuarioId = results.insertId;

            const queryTutor = 'INSERT INTO tutor (usuario_id, nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?)';
            connection.query(queryTutor, [usuarioId, nome, cpf, telefone, email, ''], (err2) => {
                if (err2) {
                    if (err2.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ erro: 'CPF ou e-mail já cadastrado.' });
                    }
                    return res.status(500).json({ erro: 'Erro ao cadastrar tutor.' });
                }

                return res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
            });
        });
    } catch (error) {
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

        try{
            const senhaCorreta = await argon2.verify(senha, usuario.senha);
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
        } catch {
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

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000 em http://localhost:3000');
});