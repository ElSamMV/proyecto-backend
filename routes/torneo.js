const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../utils/auth');

//Metodos GET UNICO
router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params; // Captura el id del registro
    //Consulta para obtener un unico registro
    const query = 'select * from torneo where id_torneo=?';
    db.query(query, [id], (err, results) => {

        if (err) {//error en la base de datos o en la consulta
            console.error(err)
            return res.status(500).json({ error: 'Error al obtener el torneo' })
        }
        //sino se encuentra el usuario
        if (results.length === 0) {
            return res.status(404).json({ message: 'Torneo no encontrado' })
        }
        //Si se encuentra devuelve los datos
        res.json(results[0]);


    });
});

router.get('/', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const string = req.query.string;
    let whereClause = '';
    let queryParams = [];

    if (string) {
        whereClause = 'WHERE id_torneo LIKE ? OR torneo LIKE ? OR pais_sede LIKE ? OR nombre_estadio LIKE ?';
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Consulta total
    const countQuery = `SELECT COUNT(*) AS total FROM torneo ${whereClause}`;

    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total de torneos' });
        }

        const totalTorneos = countResult[0].total;
        const totalPages = Math.ceil(totalTorneos / limit);

        // Consulta paginada
        const torneosQuery = `SELECT * FROM torneo ${whereClause} LIMIT ? OFFSET ?`;
        const finalParams = [...queryParams, limit, offset];

        db.query(torneosQuery, finalParams, (err, torneosResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener los torneos' });
            }

            res.json({
                totalItems: totalTorneos,
                totalPage: totalPages,
                currentPage: page,
                limit: limit,
                data: torneosResult
            });
        });
    });
});

// GET - Obtener un torneo por ID
router.get('/:id', verifyToken, (req, res) => {
    db.query('SELECT * FROM torneo WHERE id_torneo = ?', [req.params.id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener torneo' });
        }
        if (results.length === 0) return res.status(404).json({ message: 'Torneo no encontrado' });
        res.json(results[0]);
    });
});

// POST - Crear nuevo torneo
router.post('/', verifyToken, (req, res) => {
    // 1. Extraemos los campos exactos de tu tabla 'torneo'
    const { nombre, tipo, pais_sede, fecha_inicio, fecha_fin, estado, id_admin } = req.body;

    // 2. Validación de campos obligatorios (puedes ajustar cuáles son obligatorios)
    if (!nombre || !tipo || !id_admin) {
        return res.status(400).json({
            error: 'Los campos nombre, tipo e id_admin son obligatorios'
        });
    }

    // 3. Preparamos la consulta SQL para la tabla 'torneo'
    // Nota: id_torneo no se incluye si es AUTO_INCREMENT en tu DB
    const query = `INSERT INTO torneo 
                   (nombre, tipo, pais_sede, fecha_inicio, fecha_fin, estado, id_admin) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const values = [nombre, tipo, pais_sede, fecha_inicio, fecha_fin, estado, id_admin];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);

            // Error de llave foránea (Si el id_admin no existe en la tabla login_administrador)
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'El id_admin proporcionado no existe' });
            }

            return res.status(500).json({ error: 'Error al guardar el torneo en la base de datos' });
        }

        res.status(201).json({
            message: 'Torneo registrado exitosamente',
            id_torneo: result.insertId // Esto devuelve el ID que la DB generó automáticamente
        });
    });
});

// PUT - Actualizar torneo
router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    const { nombre, tipo, pais_sede, fecha_inicio, fecha_fin, estado, id_admin } = req.body;

    const fields = [];
    const values = [];

    if (nombre !== undefined) {
        fields.push('nombre = ?');
        values.push(nombre);
    }
    if (tipo !== undefined) {
        fields.push('tipo = ?');
        values.push(tipo);
    }
    if (pais_sede !== undefined) {
        fields.push('pais_sede = ?');
        values.push(pais_sede);
    }
    if (fecha_inicio !== undefined) {
        fields.push('fecha_inicio = ?');
        values.push(fecha_inicio);
    }
    if (fecha_fin !== undefined) {
        fields.push('fecha_fin = ?');
        values.push(fecha_fin);
    }
    if (estado !== undefined) {
        fields.push('estado = ?');
        values.push(estado);
    }
    if (id_admin !== undefined) {
        fields.push('id_admin = ?');
        values.push(id_admin);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const query = `UPDATE torneo SET ${fields.join(', ')} WHERE id_torneo = ?`;
    values.push(id);

    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);

            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'El id_admin proporcionado no existe' });
            }

            return res.status(500).json({ error: 'Error al actualizar el torneo' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Torneo no encontrado' });
        }

        res.json({ message: 'Torneo actualizado correctamente' });
    });
});
//*** eliminar ***
router.delete('/:id', verifyToken, (req, res) => {
    // 1. Obtener el id del torneo desde los parámetros de la URL
    const { id } = req.params;

    // 2. Contar registros dependientes (Estadísticas vinculadas)
    const contar_dependientes_query = `
        SELECT 
            (SELECT COUNT(*) FROM estadistica_jugador WHERE id_torneo = ?) AS total_estadisticas
    `;

    db.query(contar_dependientes_query, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al verificar registros dependientes' });
        }

        // Verifica si el torneo tiene estadísticas antes de borrar
        if (result[0].total_estadisticas > 0) {
            return res.status(409).json({
                error: `No se puede eliminar: el torneo tiene ${result[0].total_estadisticas} registros de estadísticas asociados`
            });
        }

        // 3. Verificar si el torneo existe realmente
        const verificar_existencia_query = 'SELECT COUNT(*) AS total_torneos FROM torneo WHERE id_torneo = ?';

        db.query(verificar_existencia_query, [id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al verificar la existencia del torneo' });
            }

            // Manejo del error 404 si el ID no existe
            if (result[0].total_torneos === 0) {
                return res.status(404).json({ error: 'Torneo no encontrado' });
            }

            // 4. Definir la consulta SQL para eliminar
            const delete_query = "DELETE FROM torneo WHERE id_torneo = ?";

            // 5. Ejecutar la eliminación final
            db.query(delete_query, [id], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error al ejecutar la eliminación en la base de datos' });
                }

                res.status(200).json({
                    message: 'Torneo eliminado correctamente',
                    id_torneo: id
                });
            });
        });
    });
});

module.exports = router;