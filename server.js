//server.js 
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware 
app.use(cors());
app.use(express.json());

//importacion de rutas
const authRouter = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const equipoRoutes = require ('./routes/equipo');

//usar rutas
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/equipo', equipoRoutes);

//rutas de ejemplo 
app.get("/", (req, res) => {
    res.send("hola desde el servidor express");
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});