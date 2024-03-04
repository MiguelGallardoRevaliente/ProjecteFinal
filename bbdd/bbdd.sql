CREATE database IF NOT EXISTS chamous;

USE chamous;

-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS cartas;
-- DROP TABLE IF EXISTS mazos;

CREATE TABLE IF NOT EXISTS users (
	id 		BINARY(16) PRIMARY KEY DEFAULT(UUID_TO_BIN(UUID())),
    nombre 	VARCHAR(255) NOT NULL,
    apellidos VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    oro INT DEFAULT 0,
    foto_perfil TEXT,
    mazo_seleccionado INT,
    first_log BOOL DEFAULT true
);
/*
CREATE TABLE IF NOT EXISTS cartas (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255),
    rareza VARCHAR(255),
    ataque INT,
    vida INT,
    costo_mana INT,
    tipo VARCHAR(255),
    foto VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS mazos (
	id INT PRIMARY KEY auto_increment,
    nombre VARCHAR(255),
    num INT,
    id_usuario BINARY(16),
    FOREIGN KEY (id_usuario) REFERENCES users(id)
);	
*/

INSERT INTO users (nombre, apellidos, user, password, email)
	VALUES ('Miguel', 'Gallardo Revaliente', 'Chimpy', 'chimpy123', 'migallre@gmail.com');

SELECT *, BIN_TO_UUID(id) FROM users;
