const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
}) 

db.connect(err => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err );
        return;
    }else {
        console.log('Conexion exitosa a la base de datos MySQL');
    }
});

module.exports = db; //exporta el objeto de conexión