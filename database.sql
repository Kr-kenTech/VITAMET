CREATE TABLE `animal` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `especie` varchar(50) NOT NULL,
  `raca` varchar(50) DEFAULT NULL,
  `idade` int DEFAULT NULL,
  `sexo` varchar(20) DEFAULT NULL,
  `peso` decimal(8,2) DEFAULT NULL,
  `status_atual` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  CONSTRAINT `animal_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `tutor` (`id`) ON DELETE CASCADE
);

CREATE TABLE `consultas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int NOT NULL,
  `pet_id` int NOT NULL,
  `servico` varchar(100) NOT NULL,
  `data` date NOT NULL,
  `horario` time NOT NULL,
  `observacoes` text,
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  KEY `pet_id` (`pet_id`),
  CONSTRAINT `consultas_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `consultas_ibfk_2` FOREIGN KEY (`pet_id`) REFERENCES `animal` (`id`) ON DELETE CASCADE
);

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

CREATE TABLE `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `perfil` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
);

CREATE TABLE `veterinario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `cfmv` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf` (`cpf`),
  UNIQUE KEY `cfmv` (`cfmv`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `veterinario_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
);

-- 1. Cria a tabela de tipos de serviços fixos que estava faltando
CREATE TABLE IF NOT EXISTS tipos_servicos (
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

ALTER TABLE consultas ADD COLUMN valor DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE consultas ADD COLUMN tipo_servico VARCHAR(100);