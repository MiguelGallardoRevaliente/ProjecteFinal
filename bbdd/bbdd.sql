CREATE database IF NOT EXISTS chamous;

USE chamous;

-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS cartas;
-- DROP TABLE IF EXISTS mazos;

CREATE TABLE IF NOT EXISTS users (
	id 		BINARY(16) PRIMARY KEY DEFAULT (UUID_TO_BIN(UUID())),
    nombre 	VARCHAR(255) NOT NULL,
    apellidos VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    oro INT DEFAULT 0,
    foto_perfil TEXT,
    mazo_seleccionado INT,
    first_log BOOL DEFAULT true,
    fighting BOOL DEFAULT false,
    searching BOOL DEFAULT false
);

CREATE TABLE IF NOT EXISTS cartas (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255),
    rareza VARCHAR(255),
    ataque INT,
    vida INT,
    costo_mana INT,
    tipo VARCHAR(255),
    foto VARCHAR(255),
    id_ataque INT,
    FOREIGN KEY (id_ataque) REFERENCES ataques(id)
);

CREATE TABLE IF NOT EXISTS users_cartas (
	id_users_carta INT PRIMARY KEY auto_increment,
    id_user BINARY(16),
    id_carta INT,
    FOREIGN KEY (id_user) REFERENCES users(id),
    FOREIGN KEY (id_carta) REFERENCES cartas(id)
);
/*
CREATE TABLE IF NOT EXISTS mazos (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255),
    num INT,
    id_usuario BINARY(16),
    FOREIGN KEY (id_usuario) REFERENCES users(id)
);	
*/

CREATE TABLE IF NOT EXISTS ataques (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255),
    tipo VARCHAR(255),
    cambio INT,
    estadistica VARCHAR(255),
    duracion INT,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS mazos (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255) DEFAULT 'Mazo',
    numero INT,
    id_user BINARY(16),
    FOREIGN KEY (id_user) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mazo_cartas (
	id_mazo_carta INT PRIMARY KEY auto_increment,
	id_mazo INT,
    id_carta INT,
    FOREIGN KEY (id_mazo) REFERENCES mazos(id),
    FOREIGN KEY (id_carta) REFERENCES cartas(id)
);

CREATE TABLE IF NOT EXISTS mercado_cartas (
	id_carta_mercado INT PRIMARY KEY auto_increment,
    id_user BINARY(16),
    id_carta INT,
    precio INT,
    FOREIGN KEY (id_user) REFERENCES users(id),
    FOREIGN KEY (id_carta) REFERENCES cartas(id)
);

CREATE TABLE IF NOT EXISTS combates (
	id_combate BINARY(16) PRIMARY KEY DEFAULT (UUID_TO_BIN(UUID())),
    id_user_1 BINARY(16),
    id_user_2 BINARY(16),
    FOREIGN KEY (id_user_1) REFERENCES users(id),
    FOREIGN KEY (id_user_2) REFERENCES users(id)
);

INSERT INTO users (nombre, apellidos, user, password, email)
	VALUES ('Miguel', 'Gallardo Revaliente', 'Chimpy', 'chimpy123', 'migallre@gmail.com');

SELECT *, BIN_TO_UUID(id) FROM users;

UPDATE users SET first_log = true WHERE user = 'Chimpy' AND password = 'chimpy123';
