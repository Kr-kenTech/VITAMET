const express = require('express');
const app = express();
const mysql = require('mysql2');
const port = 3306;
const bcrypt = require('bcrypt');

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

module.exports = connection;
app.use(express.json());

app.post('/login', async (req, res) => {
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
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

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
    });
});

app.listen(3306, () => {
    console.log('Servidor rodando na porta 3306');
});
