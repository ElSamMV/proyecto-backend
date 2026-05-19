const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../utils/auth');

// ==========================================
// MÉTODOS GET
// ==========================================

// Obtener todos los equipos (con Paginación y Búsqueda)
router.get('/', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const string = req.query.string;
    let whereClause = '';
    let queryParams = [];

    // Búsqueda adaptada a las columnas de tu tabla 'equipo'
    if (string) {
        whereClause = `WHERE id_equipo LIKE ? 
                       OR nombre_equipo LIKE ? 
                       OR pais LIKE ? 
                       OR ciudad LIKE ? 
                       OR entrenador LIKE ?`;
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // 1. Consulta para obtener el total de registros para la paginación
    const countQuery = `SELECT COUNT(*) AS total FROM equipo ${whereClause}`;

    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total de equipos' });
        }

        const totalEquipos = countResult[0].total;
        const totalPages = Math.ceil(totalEquipos / limit);

        // 2. Consulta paginada con los datos reales
        const equiposQuery = `SELECT * FROM equipo ${whereClause} LIMIT ? OFFSET ?`;
        const finalParams = [...queryParams, limit, offset];

        db.query(equiposQuery, finalParams, (err, equiposResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener los equipos' });
            }

            res.json({
                totalItems: totalEquipos,
                totalPages: totalPages,
                currentPage: page,
                limit: limit,
                data: equiposResult
            });
        });
    });
});

// Obtener un único equipo por ID
router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM equipo WHERE id_equipo = ?';
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener el equipo' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }
        res.json(results[0]);
    });
});

// ==========================================
// MÉTODO POST (Crear)
// ==========================================

router.post('/', verifyToken, (req, res) => {
    // Extraemos los campos según el esquema de tu base de datos
    const { nombre_equipo, pais, ciudad, estadio, fundacion, entrenador, id_admin } = req.body;

    // Validación de campos obligatorios
    if (!nombre_equipo || !id_admin) {
        return res.status(400).json({ 
            error: 'Los campos nombre_equipo e id_admin son obligatorios' 
        });
    }

    const query = `INSERT INTO equipo 
                   (nombre_equipo, pais, ciudad, estadio, fundacion, entrenador, id_admin) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const values = [nombre_equipo, pais, ciudad, estadio, fundacion, entrenador, id_admin];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);
            // Manejo de error por llave foránea si el admin no existe
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'El id_admin proporcionado no existe' });
            }
            return res.status(500).json({ error: 'Error al registrar el equipo' });
        }

        res.status(201).json({
            message: 'Equipo registrado exitosamente',
            id_equipo: result.insertId
        });
    });
});

// ==========================================
// MÉTODO PUT (Actualizar)
// ==========================================

router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { nombre_equipo, pais, ciudad, estadio, fundacion, entrenador, id_admin } = req.body;

    const fields = [];
    const values = [];

    // Mapeo dinámico para actualizar solo los campos presentes en el body
    const updates = { nombre_equipo, pais, ciudad, estadio, fundacion, entrenador, id_admin };
    
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const query = `UPDATE equipo SET ${fields.join(', ')} WHERE id_equipo = ?`;
    values.push(id);

    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'El id_admin proporcionado no existe' });
            }
            return res.status(500).json({ error: 'Error al actualizar el equipo' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }

        res.json({ message: 'Equipo actualizado correctamente' });
    });
});
//DELETE

router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    // 1. Verificar si el equipo existe
    const consultar_equipo = 'SELECT COUNT(*) AS count FROM equipo WHERE id_equipo = ?';
    
    db.query(consultar_equipo, [id], (err, equipoResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al verificar el equipo' });
        }

        if (equipoResult[0].count === 0) {
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }

        //Verifica si hay jugadores asociados a este equipo
        const consultar_jugadores = 'SELECT COUNT(*) AS count FROM jugador WHERE id_equipo = ?';
        
        db.query(consultar_jugadores, [id], (err, jugadorResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al verificar jugadores asociados' });
            }

            // Si hay al menos un jugadorel equipo no elimina
            if (jugadorResult[0].count > 0) {
                return res.status(409).json({ 
                    error: 'No se puede eliminar el equipo porque tiene jugadores asociados' 
                });
            }

            // Si no hay jugadores elimina
            const query_delete = 'DELETE FROM equipo WHERE id_equipo = ?';
            db.query(query_delete, [id], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error al eliminar el equipo' });
                }

                res.status(200).json({ 
                    message: 'Equipo eliminado correctamente', 
                    id_equipo: id 
                });
            });
        });
    });
});

module.exports = router;