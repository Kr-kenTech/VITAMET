-- 4. Cria a tabela de usuários
CREATE TABLE `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `senha` varchar(255) NOT NULL,
  `perfil` varchar(50) NOT NULL DEFAULT 'tutor',
  `banido` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
);

-- 5. Cria a tabela de tutores (já com cpf e telefone garantidos)
CREATE TABLE `tutor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `endereco` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf` (`cpf`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `tutor_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
);

-- 6. Cria a tabela de animais
CREATE TABLE `animal` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `especie` varchar(100) NOT NULL,
  `raca` varchar(100) DEFAULT NULL,
  `idade` int DEFAULT NULL,
  `sexo` varchar(20) DEFAULT NULL,
  `peso` decimal(5,2) DEFAULT NULL,
  `status_atual` varchar(50) DEFAULT 'Ativo',
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  CONSTRAINT `animal_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `tutor` (`id`) ON DELETE CASCADE
);

-- 7. Cria a tabela de consultas
CREATE TABLE `consultas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int NOT NULL,
  `pet_id` int NOT NULL,
  `servico` varchar(100) NOT NULL,
  `data` date NOT NULL,
  `horario` time NOT NULL,
  `observacoes` text,
  `valor` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  KEY `pet_id` (`pet_id`),
  CONSTRAINT `consultas_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `tutor` (`id`) ON DELETE CASCADE,
  CONSTRAINT `consultas_ibfk_2` FOREIGN KEY (`pet_id`) REFERENCES `animal` (`id`) ON DELETE CASCADE
);

CREATE TABLE tipos_servicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    valor_padrao DECIMAL(10,2) DEFAULT 0.00
);

INSERT INTO tipos_servicos (nome, valor_padrao) VALUES
('Consultas', 150.00),
('Vacinas', 80.00),
('Exames', 200.00),
('Higiene e cuidados', 90.00)
AS novo_valor
ON DUPLICATE KEY UPDATE valor_padrao = novo_valor.valor_padrao;

CREATE TABLE publicacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id INT,
  titulo VARCHAR(255),
    autor VARCHAR(255),
    iniciais VARCHAR(10),
    texto TEXT,
    categoria VARCHAR(100),
    curtidas INT DEFAULT 0,
    oculta TINYINT(1) NOT NULL DEFAULT 0,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de comentários vinculada à publicação e ao tutor
CREATE TABLE comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    publicacao_id INT NOT NULL,
    tutor_id INT NOT NULL,
    texto TEXT NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id) ON DELETE CASCADE,
    FOREIGN KEY (tutor_id) REFERENCES tutor(id) ON DELETE CASCADE
);

CREATE TABLE curtidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    publicacao_id INT NOT NULL,
    tutor_id INT NOT NULL,
    FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id) ON DELETE CASCADE,
    FOREIGN KEY (tutor_id) REFERENCES tutor(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (publicacao_id, tutor_id) -- Impede que o mesmo tutor curta a mesma publicação duas vezes
);

  CREATE TABLE denuncias_publicacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    publicacao_id INT NOT NULL,
    usuario_id INT NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY denuncia_unica (publicacao_id, usuario_id),
    FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
  );

  CREATE TABLE notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    link VARCHAR(255),
    lida TINYINT(1) NOT NULL DEFAULT 0,
    agendada_para DATETIME DEFAULT NULL,
    chave_evento VARCHAR(180) DEFAULT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY chave_evento_unica (chave_evento),
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
  );

CREATE TABLE logistica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(100),
    quantidade INT DEFAULT 0,
    custo DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Normal'
);

CREATE TABLE pedidos_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_pedido VARCHAR(50),
    fornecedor VARCHAR(150),
    data DATE,
    valor_total DECIMAL(10,2),
    status VARCHAR(50)
);

  CREATE TABLE relatorios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    periodo VARCHAR(100) NOT NULL,
    descricao TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Concluído',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

-- Prontuários clínicos
CREATE TABLE IF NOT EXISTS prontuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    animal_id INT NOT NULL,
    veterinario_id INT NOT NULL,
    consulta_id INT DEFAULT NULL,
    queixa TEXT NOT NULL,
    diagnostico TEXT,
    tratamento TEXT,
    observacoes TEXT,
    data_atendimento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id) REFERENCES animal(id) ON DELETE CASCADE,
    FOREIGN KEY (veterinario_id) REFERENCES veterinario(id) ON DELETE CASCADE
);

-- Receitas médicas
CREATE TABLE IF NOT EXISTS receitas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    animal_id INT NOT NULL,
    veterinario_id INT NOT NULL,
    medicamento VARCHAR(180) NOT NULL,
    posologia TEXT NOT NULL,
    validade DATE DEFAULT NULL,
    observacoes TEXT,
    emitida_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id) REFERENCES animal(id) ON DELETE CASCADE,
    FOREIGN KEY (veterinario_id) REFERENCES veterinario(id) ON DELETE CASCADE
);

CREATE TABLE veterinario (
    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario_id INT NOT NULL,

    cpf VARCHAR(14) NOT NULL,

    crmv VARCHAR(30) DEFAULT NULL,

    area_atuacao VARCHAR(120) DEFAULT 'Clínica geral',

    UNIQUE KEY veterinario_usuario_unica (usuario_id),

    UNIQUE KEY veterinario_cpf_unico (cpf),

    UNIQUE KEY veterinario_crmv_unico (crmv),

    FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
        ON DELETE CASCADE
);

INSERT INTO usuario (nome, email, senha, perfil)
VALUES ('Lucas', 'backuplucas309@gmail.com', '123456', 'admin');
