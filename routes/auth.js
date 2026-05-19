const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/auth');

// POST - Autenticación de administrador
router.post('/login', (req, res) => {
    const { cedula, contrasena } = req.body;

    // Validar que se envíen los campos
    if (!cedula || !contrasena) {
        return res.status(400).json({ 
            error: 'Los campos cédula y contraseña son obligatorios' 
        });
    }

    db.query(
        'SELECT * FROM login_administrador WHERE cedula = ?',
        [cedula],
        async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error en el servidor' });
            }

            if (results.length === 0) {
                return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
            }

            const user = results[0];

            const isPasswordValid = await bcrypt.compare(contrasena, user.contrasena);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
            }

            const token = generateToken({
                id: user.id,
                cedula: user.cedula
            });

            res.json({ 
                message: 'Logueo exitoso', 
                id: user.id,
                cedula: user.cedula, 
                token 
            });
        }
    );
});

module.exports = router;