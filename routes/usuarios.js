const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../utils/auth');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

// GET - Listado paginado con búsqueda
router.get('/', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const string = req.query.string || '';

    let whereClause = '';
    let queryParams = [];

    if (string.trim() !== '') {
        whereClause = 'WHERE cedula LIKE ? OR nombre_completo LIKE ?';
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    const countQuery = `SELECT COUNT(*) AS total FROM login_administrador ${whereClause}`;

    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total' });
        }

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const dataParams = [...queryParams, limit, offset];
        const dataQuery = `SELECT id, cedula, nombre_completo, fecha_nacimiento, correo, telefono 
                           FROM login_administrador ${whereClause} LIMIT ? OFFSET ?`;

        db.query(dataQuery, dataParams, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener datos' });
            }

            res.json({
                totalItems: total,
                totalPages: totalPages,
                currentPage: page,
                limit: limit,
                data: results
            });
        });
    });
});

// GET - Obtener un administrador por id
router.get('/:id', verifyToken, (req, res) => {
    db.query('SELECT * FROM login_administrador WHERE id = ?', [req.params.id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener usuario' });
        }
        if (results.length === 0) return res.status(404).json({ message: 'No encontrado' });
        res.json(results[0]);
    });
});

// POST - Crear nuevo administrador

router.post('/', verifyToken, async (req, res) => {
    const { cedula, contrasena, nombre_completo, fecha_nacimiento, correo, telefono } = req.body;

    if (!cedula || !contrasena || !nombre_completo) {
        return res.status(400).json({ 
            error: 'Los campos cédula, contraseña y nombre completo son obligatorios' 
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(contrasena, SALT_ROUNDS);

        const query = `INSERT INTO login_administrador 
                       (cedula, contrasena, nombre_completo, fecha_nacimiento, correo, telefono) 
                       VALUES (?, ?, ?, ?, ?, ?)`;

        const values = [cedula, hashedPassword, nombre_completo, fecha_nacimiento, correo, telefono];

        db.query(query, values, (err, result) => {
            if (err) {
                console.error(err);

                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Ya existe un administrador con esa cédula' });
                }

                return res.status(500).json({ error: 'Error al guardar en la base de datos' });
            }

            res.status(201).json({
                message: 'Administrador registrado exitosamente',
                id: result.insertId,
                cedula: cedula
            });
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al procesar la contraseña' });
    }
});

// PUT - Editar 
router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { contrasena, nombre_completo, fecha_nacimiento, correo, telefono } = req.body;

    const fields = [];
    const values = [];

    if (contrasena !== undefined) { fields.push('contrasena = ?'); values.push(contrasena); }
    if (nombre_completo !== undefined) { fields.push('nombre_completo = ?'); values.push(nombre_completo); }
    if (fecha_nacimiento !== undefined) { fields.push('fecha_nacimiento = ?'); values.push(fecha_nacimiento); }
    if (correo !== undefined) { fields.push('correo = ?'); values.push(correo); }
    if (telefono !== undefined) { fields.push('telefono = ?'); values.push(telefono); }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const query = `UPDATE login_administrador SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al actualizar el administrador' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        res.json({ message: 'Administrador actualizado correctamente' });
    });
});

// DELETE - Eliminar administrador
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const tablasRelacionadas = ['equipo', 'jugador', 'torneo', 'estadistica_jugador'];

    // Convertir cada verificación a una Promise para manejarlas en paralelo de forma segura
    const verificaciones = tablasRelacionadas.map((tabla) => {
        return new Promise((resolve, reject) => {
            const query = `SELECT COUNT(*) AS contador FROM ${tabla} WHERE id_admin = ?`;
            db.query(query, [id], (err, result) => {
                if (err) return reject({ tabla, err });
                resolve({ tabla, contador: result[0].contador });
            });
        });
    });

    Promise.all(verificaciones)
        .then((resultados) => {
            const conRelaciones = resultados.filter(r => r.contador > 0);

            if (conRelaciones.length > 0) {
                // Informar exactamente qué tablas tienen registros
                const tablas = conRelaciones.map(r => `${r.tabla} (${r.contador})`).join(', ');
                return res.status(409).json({
                    error: `El administrador tiene registros relacionados.`
                });
            }

            // Sin relaciones → eliminar
            db.query('DELETE FROM login_administrador WHERE id = ?', [id], (err, result) => {
                if (err) {
                    console.error('Error al eliminar:', err);
                    return res.status(500).json({ error: 'Error al eliminar usuario' });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'Administrador no encontrado' });
                }
                res.json({ message: 'ADMINISTRADOR eliminado exitosamente', id });
            });
        })
        .catch(({ tabla, err }) => {
            console.error(`Error verificando tabla ${tabla}:`, err);
            res.status(500).json({ error: 'Error interno al verificar relaciones' });
        });
});
module.exports = router;