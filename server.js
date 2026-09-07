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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'inicio.html'));
});

app.get('/admin/:page', (req, res) => {
    const pagina = decodeURIComponent(req.params.page);
    res.sendFile(path.join(__dirname, 'admin', pagina));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'user', 'dashboard.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
});

app.get('/tutor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'user', 'tutor.html'));
});

// Rota de Usuário por ID
app.get('/usuario/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.id, u.nome, u.email, u.perfil, t.cpf, t.telefone, t.endereco 
        FROM usuario u 
        LEFT JOIN tutor t ON t.usuario_id = u.id 
        WHERE u.id = ?
    `;

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao buscar usuário por ID:", err);
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
        // Gera o hash compatível com o @node-rs/argon2
        const senhaHash = await argon2.hash(senha);

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

app.post('/login', (req, res) => {
    console.log("-> Requisição de login recebida:", req.body);
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    const query = 'SELECT * FROM usuario WHERE email = ?';
    connection.query(query, [email], async (err, results) => {
        if (err) {
            console.error("ERRO MYSQL NO LOGIN:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor (MySQL).' });
        }

        if (results.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos!' });
        }

        const usuario = results[0];
        console.log("Usuário encontrado no banco:", usuario.email);

        try {
            let senhaValida = false;

            if (usuario.senha && (usuario.senha.startsWith('$argon2') || usuario.senha.length > 50)) {
                try {
                    senhaValida = await argon2.verify(usuario.senha, senha);
                } catch (argonError) {
                    console.error("ERRO ARGON2 VERIFY:", argonError);
                    senhaValida = false;
                }
            } else {
                senhaValida = (usuario.senha === senha);
            }

            console.log("Senha válida?", senhaValida);

            if (!senhaValida) {
                return res.status(401).json({ erro: 'E-mail ou senha incorretos!' });
            }

            return res.status(200).json({
                mensagem: 'Login realizado com sucesso!',
                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: usuario.perfil || 'tutor'
                }
            });
        } catch (erroGeral) {
            console.error("ERRO CRÍTICO NO TRY/CATCH DO LOGIN:", erroGeral);
            return res.status(500).json({ erro: 'Erro interno no servidor (Geral).' });
        }
    });
});

function enviarRespostaLogin(res, usuario, idNavegacao) {
    return res.status(200).json({
        mensagem: 'Login realizado com sucesso!',
        usuario: {
            id: idNavegacao, // ID mapeado corretamente para o perfil
            usuario_id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil // 'tutor', 'veterinario' ou 'admin'
        }
    });
}

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

app.get('/api/tutores', (req, res) => {
    const query = 'SELECT id, nome, cpf FROM tutor';
    connection.query(query, (err, tutores) => {
        if (err) {
            console.error("Erro ao buscar tutores:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar tutores.' });
        }
        res.json(tutores);
    });
});

// Rota para buscar os pets e o status em tempo real pelo ID do tutor
app.get('/api/tutores/:tutorId/pets', (req, res) => {
    const { tutorId } = req.params;

    const query = `
        SELECT id, nome, especie, raca, idade, sexo, peso, status_atual 
        FROM animal 
        WHERE tutor_id = ?
    `;

    connection.query(query, [tutorId], (err, results) => {
        if (err) {
            console.error("Erro ao buscar status dos pets:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        return res.status(200).json(results);
    });
});

app.get('/api/animais/tutor/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const query = "SELECT a.id, a.nome, a.especie, a.raca, a.idade, a.sexo, a.peso, a.status_atual FROM animal a JOIN tutor t ON a.tutor_id = t.id WHERE t.usuario_id = ?";

    connection.query(query, [usuarioId], (err, results) => {
        if (err) {
            console.error("Erro ao buscar animais:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        return res.status(200).json(results);
    });
});

app.post('/api/pets', (req, res) => {
    const { tutor_id, nome, especie, raca, idade, peso } = req.body;
    
    if (!tutor_id || !nome || !especie) {
        return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
    }

    const query = `
        INSERT INTO animal (tutor_id, nome, especie, raca, idade, peso, status_atual) 
        VALUES (?, ?, ?, ?, ?, ?, 'Ativo')
    `;
    
    connection.query(query, [tutor_id, nome, especie, raca || '', idade || null, peso || null], (err, result) => {
        if (err) {
            console.error("Erro ao cadastrar pet:", err);
            return res.status(500).json({ erro: 'Erro interno ao salvar pet no banco.' });
        }
        res.status(201).json({ mensagem: 'Pet cadastrado com sucesso!', id: result.insertId });
    });
});

app.get('/api/pets', (req, res) => {
    const query = `
        SELECT a.*, t.nome AS nome_tutor 
        FROM animal a 
        LEFT JOIN tutor t ON a.tutor_id = t.id
    `;
    
    connection.query(query, (err, pets) => {
        if (err) {
            console.error("Erro ao buscar pets:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar pets.' });
        }
        res.json(pets);
    });
});

// ==========================================
// ROTAS DE AGENDAMENTOS E CONSULTAS
// ==========================================

app.post('/api/consultas', (req, res) => {
    const { animal_id, data, hora, tipo, observacoes, valor } = req.body;

    if (!animal_id || !data || !hora || !tipo) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios do agendamento.' });
    }

    const queryTutorPet = `
        SELECT t.id AS tutor_id, t.usuario_id 
        FROM animal a 
        JOIN tutor t ON a.tutor_id = t.id 
        WHERE a.id = ?
    `;

    connection.query(queryTutorPet, [animal_id], (err, resultsPet) => {
        if (err || resultsPet.length === 0) {
            return res.status(404).json({ erro: 'Pet ou tutor não encontrado.' });
        }

        const tutorId = resultsPet[0].tutor_id;
        const obsText = observacoes || '';
        const valorConsulta = valor !== undefined ? valor : 0.00;
        const queryInsert = "INSERT INTO consultas (tutor_id, pet_id, servico, data, horario, observacoes, valor) VALUES (?, ?, ?, ?, ?, ?, ?)";

        connection.query(queryInsert, [tutorId, animal_id, tipo, data, hora, obsText, valorConsulta], (errInsert, results) => {
            if (errInsert) {
                if (errInsert.code === 'ER_DUP_ENTRY' || errInsert.errno === 1062) {
                    return res.status(400).json({ 
                        erro: 'Já existe uma consulta agendada para esta mesma data e horário!' 
                    });
                }

                console.error("Erro detalhado ao salvar consulta no MySQL:", errInsert);
                return res.status(500).json({ erro: 'Erro ao salvar agendamento no banco.' });
            }
            return res.status(201).json({ mensagem: 'Consulta agendada com sucesso!', id: results.insertId });
        });
    });
});

app.get('/api/agendamentos/tutor/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;

    const query = `
        SELECT c.id, a.nome AS pet, c.servico, c.data, c.horario, c.observacoes, c.valor, 'Agendado' AS status 
        FROM consultas c 
        JOIN animal a ON c.pet_id = a.id 
        JOIN tutor t ON c.tutor_id = t.id
        WHERE t.usuario_id = ?
        ORDER BY c.data ASC
    `;

    connection.query(query, [usuarioId], (err, results) => {
        if (err) {
            console.error("Erro ao buscar agendamentos:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        return res.status(200).json(results);
    });
});

app.get('/api/gastos/:tutor_id', (req, res) => {
    const { tutor_id } = req.params;
    
    const queryTotal = "SELECT SUM(valor) as totalGasto FROM consultas WHERE tutor_id = ?";
    const queryPorTipo = "SELECT servico as tipo_servico, SUM(valor) as total FROM consultas WHERE tutor_id = ? GROUP BY servico";

    connection.query(queryTotal, [tutor_id], (err, resultTotal) => {
        if (err) {
            console.error("Erro ao buscar total:", err);
            return res.status(500).json({ erro: 'Erro no servidor' });
        }

        connection.query(queryPorTipo, [tutor_id], (err, resultTipos) => {
            if (err) {
                console.error("Erro ao buscar tipos:", err);
                return res.status(500).json({ erro: 'Erro no servidor' });
            }

            res.status(200).json({
                totalGasto: resultTotal[0].totalGasto || 0,
                porTipo: resultTipos
            });
        });
    });
});

// ==========================================
// ROTAS DA COMUNIDADE (PUBLICAÇÕES, CURTIDAS E COMENTÁRIOS)
// ==========================================

// Criar uma nova publicação (Compatível com tabelas que só têm tutor_id e texto)
app.post('/api/publicacoes', (req, res) => {
    const { tutor_id, texto } = req.body;

    if (!tutor_id || !texto) {
        return res.status(400).json({ erro: 'O tutor e o texto da publicação são obrigatórios.' });
    }

    const query = "INSERT INTO publicacoes (tutor_id, texto) VALUES (?, ?)";
    
    connection.query(query, [tutor_id, texto], (err, results) => {
        if (err) {
            console.error("Erro ao criar publicação:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        res.status(201).json({ 
            id: results.insertId, 
            mensagem: 'Publicação criada com sucesso!' 
        });
    });
});

app.get('/api/publicacoes', (req, res) => {
    // Se a tabela tiver a coluna 'titulo', use-a. Se não, pegamos os primeiros 30 caracteres do 'texto' como título.
    const query = `
        SELECT id, tutor_id, categoria, texto, texto AS titulo, data 
        FROM publicacoes 
        ORDER BY id DESC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Erro ao buscar publicações:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar publicações.' });
        }
        res.status(200).json(results);
    });
});

// Rota para curtir ou descurtir uma publicação
app.put('/api/publicacoes/:id/curtir', async (req, res) => {
    const publicacaoId = req.params.id;
    const { tutor_id } = req.body;

    try {
        // Verifica se o tutor já curtiu esta publicação
        const [rows] = await connection.promise().query(
            'SELECT * FROM curtidas WHERE publicacao_id = ? AND tutor_id = ?',
            [publicacaoId, tutor_id]
        );

        if (rows.length > 0) {
            // Se já curtiu, remove a curtida (descurtir)
            await connection.promise().query(
                'DELETE FROM curtidas WHERE publicacao_id = ? AND tutor_id = ?',
                [publicacaoId, tutor_id]
            );
            
            // Decrementa o contador na tabela publicacoes
            await connection.promise().query(
                'UPDATE publicacoes SET curtidas = GREATEST(curtidas - 1, 0) WHERE id = ?',
                [publicacaoId]
            );
            
            return res.status(200).json({ mensagem: 'Curtida removida', curtido: false });
        } else {
            // Se não curtiu, adiciona a curtida
            await connection.promise().query(
                'INSERT INTO curtidas (publicacao_id, tutor_id) VALUES (?, ?)',
                [publicacaoId, tutor_id]
            );
            
            // Incrementa o contador na tabela publicacoes
            await connection.promise().query(
                'UPDATE publicacoes SET curtidas = curtidas + 1 WHERE id = ?',
                [publicacaoId]
            );
            
            return res.status(200).json({ mensagem: 'Publicação curtida', curtido: true });
        }
    } catch (erro) {
        console.error("Erro ao processar curtida:", erro);
        res.status(500).json({ erro: 'Erro interno ao processar curtida.' });
    }
});

// ==========================================
// ROTAS DE COMENTÁRIOS DAS PUBLICAÇÕES
// ==========================================

// Listar comentários de uma publicação específica (Versão Segura sem JOIN)
app.get('/api/publicacoes/:id/comentarios', (req, res) => {
    const { id } = req.params;
    const query = "SELECT id, publicacao_id, tutor_id, texto, data FROM comentarios WHERE publicacao_id = ? ORDER BY id DESC";
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao buscar comentários:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar comentários: ' + err.message });
        }
        res.status(200).json(results);
    });
});

app.post('/api/publicacoes/:id/comentarios', (req, res) => {
    const publicacaoId = req.params.id;
    const { tutor_id, usuario_id, texto } = req.body;

    if (!texto) {
        return res.status(400).json({ erro: 'O texto do comentário não pode estar vazio.' });
    }

    const salvarNoBanco = (idTutorReal) => {
        const query = "INSERT INTO comentarios (publicacao_id, tutor_id, texto, data) VALUES (?, ?, ?, NOW())";
        connection.query(query, [publicacaoId, idTutorReal, texto], (err, result) => {
            if (err) {
                console.error("Erro ao salvar comentário:", err);
                return res.status(500).json({ erro: 'Erro interno ao salvar comentário.' });
            }
            res.status(201).json({ mensagem: 'Comentário adicionado com sucesso!', id: result.insertId });
        });
    };

    // Se o front-end mandou um ID que na verdade é o de usuário, ou se precisamos buscar o tutor vinculado:
    // Tentamos primeiro ver se existe um registro na tabela tutor onde o id ou usuario_id seja igual ao ID recebido
    const idEnviado = tutor_id || usuario_id;

    if (!idEnviado) {
        return res.status(400).json({ erro: 'Identificação do tutor é obrigatória.' });
    }

    // Verifica se o ID enviado existe diretamente na tabela tutor
    const queryVerificaTutor = "SELECT id FROM tutor WHERE id = ?";
    connection.query(queryVerificaTutor, [idEnviado], (err, resultsTutor) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao verificar tutor.' });
        }

        if (resultsTutor.length > 0) {
            // O ID enviado já é o ID correto do tutor!
            salvarNoBanco(resultsTutor[0].id);
        } else {
            // Se não achou pelo ID direto, tenta buscar pelo campo usuario_id (caso exista na sua tabela tutor)
            const queryBuscaPorUsuario = "SELECT id FROM tutor WHERE usuario_id = ?";
            connection.query(queryBuscaPorUsuario, [idEnviado], (err, resultsUsuario) => {
                if (err || resultsUsuario.length === 0) {
                    return res.status(400).json({ 
                        erro: 'O tutor associado a este usuário não foi encontrado no banco de dados. Cadastre o perfil do pet/tutor primeiro.' 
                    });
                }
                salvarNoBanco(resultsUsuario[0].id);
            });
        }
    });
});

// Excluir publicação
app.delete('/api/publicacoes/:id', (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM publicacoes WHERE id = ?";

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir publicação:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        res.status(200).json({ mensagem: 'Publicação excluída com sucesso!' });
    });
});

// Rota para excluir um comentário
app.delete('/api/comentarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await connection.promise().query('DELETE FROM comentarios WHERE id = ?', [id]);
        res.status(200).json({ mensagem: 'Comentário excluído com sucesso!' });
    } catch (erro) {
        console.error("Erro ao excluir comentário:", erro);
        res.status(500).json({ erro: 'Erro interno ao excluir comentário.' });
    }
});

// Excluir animal
app.delete('/api/animais/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM animal WHERE id = ?';

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir animal:", err);
            return res.status(500).json({ erro: 'Erro ao excluir o animal do banco de dados.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ erro: 'Animal não encontrado.' });
        }

        return res.status(200).json({ mensagem: 'Animal excluído com sucesso!' });
    });
});

// Excluir consulta
app.delete('/api/agendamentos/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM consultas WHERE id = ?';

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir consulta:", err);
            return res.status(500).json({ erro: 'Erro ao excluir a consulta.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ erro: 'Consulta não encontrada.' });
        }

        return res.status(200).json({ mensagem: 'Consulta excluída com sucesso!' });
    });
});

// Tipos de serviços
app.get('/api/tipos-servicos', (req, res) => {
    const query = "SELECT * FROM tipos_servicos";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Erro ao buscar tipos de serviços:", err);
            return res.status(500).json({ erro: 'Erro no servidor' });
        }
        res.status(200).json(results);
    });
});

// ==========================================
// ROTA DE ESTATÍSTICAS DO PAINEL ADMIN
// ==========================================
app.get('/api/dashboard/estatisticas', async (req, res) => {
    try {
        const promisePool = connection.promise();

        // Conta quantos tutores existem na tabela tutor
        const [tutoresRes] = await promisePool.query("SELECT COUNT(*) AS total FROM tutor");
        // Conta quantos pets existem
        const [petsRes] = await promisePool.query("SELECT COUNT(*) AS total FROM animal");
        // Conta quantos veterinários existem (ajuste o perfil conforme salvo no seu banco)
        const [vetsRes] = await promisePool.query("SELECT COUNT(*) AS total FROM usuario WHERE perfil = 'veterinario' OR perfil = 'vet'");
        // Conta quantas consultas ou prontuários existem
        const [prontuariosRes] = await promisePool.query("SELECT COUNT(*) AS total FROM consultas"); // Ou mude para sua tabela de prontuários se houver

        res.status(200).json({
            totalTutores: tutoresRes[0].total || 0,
            totalPets: petsRes[0].total || 0,
            totalVets: vetsRes[0].total || 0,
            totalProntuarios: prontuariosRes[0].total || 0
        });
    } catch (err) {
        console.error("Erro ao buscar estatísticas do dashboard:", err);
        res.status(500).json({ erro: 'Erro interno ao buscar estatísticas.' });
    }
});

// ==========================================
// ROTAS DE VETERINÁRIOS
// ==========================================

// Listar veterinários
app.get('/api/veterinarios', (req, res) => {
    const query = "SELECT id, nome, email, perfil FROM usuario WHERE perfil = 'veterinario' OR perfil = 'vet'";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Erro ao buscar veterinários:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar veterinários.' });
        }
        res.status(200).json(results);
    });
});

// Cadastrar veterinário
app.post('/api/veterinarios', async (req, res) => {
    const { nome, email, senha, perfil } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const senhaHash = await argon2.hash(senha);
        const query = "INSERT INTO usuario (nome, email, senha, perfil) VALUES (?, ?, ?, ?)";
        
        connection.query(query, [nome, email, senhaHash, perfil || 'veterinario'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
                }
                console.error("Erro ao cadastrar veterinário:", err);
                return res.status(500).json({ erro: 'Erro interno ao salvar veterinário.' });
            }
            res.status(201).json({ mensagem: 'Veterinário cadastrado com sucesso!', id: result.insertId });
        });
    } catch (error) {
        console.error("Erro ao gerar hash da senha:", error);
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

// Excluir veterinário
app.delete('/api/veterinarios/:id', (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM usuario WHERE id = ?";

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir veterinário:", err);
            return res.status(500).json({ erro: 'Erro ao excluir veterinário.' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ erro: 'Veterinário não encontrado.' });
        }
        res.status(200).json({ mensagem: 'Veterinário excluído com sucesso!' });
    });
});

// ==========================================
// ROTAS DE GESTÃO DE USUÁRIOS
// ==========================================

// Listar todos os usuários
app.get('/api/usuarios', (req, res) => {
    const query = "SELECT id, nome, email, perfil FROM usuario WHERE perfil != 'admin'";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Erro ao buscar usuários:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar usuários.' });
        }
        res.status(200).json(results);
    });
});

// Excluir usuário por ID
app.delete('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM usuario WHERE id = ?";

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir usuário:", err);
            return res.status(500).json({ erro: 'Erro ao excluir usuário.' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }
        res.status(200).json({ mensagem: 'Usuário excluído com sucesso!' });
    });
});

// ==========================================
// ROTAS DE PUBLICAÇÕES (ADMINISTRAÇÃO)
// ==========================================

// Listar todas as publicações
app.get('/api/publicacoes', (req, res) => {
    const query = "SELECT id, titulo, categoria, conteudo, data_criacao FROM publicacao ORDER BY id DESC";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Erro ao buscar publicações:", err);
            return res.status(500).json({ erro: 'Erro interno ao buscar publicações.' });
        }
        res.status(200).json(results);
    });
});

// Cadastrar nova publicação
app.post('/api/publicacoes', (req, res) => {
    const { titulo, categoria, conteudo } = req.body;

    if (!titulo || !conteudo) {
        return res.status(400).json({ erro: 'Preencha o título e o conteúdo da publicação.' });
    }

    const query = "INSERT INTO publicacao (titulo, categoria, conteudo, data_criacao) VALUES (?, ?, ?, NOW())";
    connection.query(query, [titulo, categoria || 'Geral', conteudo], (err, result) => {
        if (err) {
            console.error("Erro ao salvar publicação:", err);
            return res.status(500).json({ erro: 'Erro interno ao salvar publicação.' });
        }
        res.status(201).json({ mensagem: 'Publicação criada com sucesso!', id: result.insertId });
    });
});

// Excluir publicação por ID
app.delete('/api/publicacoes/:id', (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM publicacao WHERE id = ?";

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error("Erro ao excluir publicação:", err);
            return res.status(500).json({ erro: 'Erro ao excluir publicação.' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ erro: 'Publicação não encontrada.' });
        }
        res.status(200).json({ mensagem: 'Publicação excluída com sucesso!' });
    });
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000 em http://localhost:3000');
});