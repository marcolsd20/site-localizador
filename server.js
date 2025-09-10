const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// --- Criar banco de dados ---
const db = new sqlite3.Database('./usuarios.db', (err) => {
    if(err) console.error(err.message);
    else console.log('Conectado ao banco SQLite.');
});

// --- Criar tabela de usuários ---
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    senha TEXT
)`);

// --- Registro ---
app.post('/register', async (req, res) => {
    const { usuario, senha } = req.body;
    if(!usuario || !senha) return res.json({ success:false, error:'Preencha usuário e senha' });

    try {
        const hash = await bcrypt.hash(senha, 10);
        db.run(`INSERT INTO users (usuario, senha) VALUES (?, ?)`, [usuario, hash], function(err){
            if(err) return res.json({ success:false, error:'Usuário já existe!' });
            return res.json({ success:true });
        });
    } catch(e){
        console.error(e);
        return res.json({ success:false, error:'Erro no servidor' });
    }
});

// --- Login ---
app.post('/login', (req,res) => {
    const { usuario, senha } = req.body;
    if(!usuario || !senha) return res.json({ success:false, error:'Preencha usuário e senha' });

    db.get(`SELECT * FROM users WHERE usuario = ?`, [usuario], async (err,row) => {
        if(err) return res.json({ success:false, error:'Erro no servidor' });
        if(!row) return res.json({ success:false, error:'Usuário não encontrado' });

        const match = await bcrypt.compare(senha, row.senha);
        if(match) return res.json({ success:true });
        else return res.json({ success:false, error:'Senha incorreta' });
    });
});

// --- Servir o index.html e assets ---
app.use(express.static(path.join(__dirname)));

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`✅ Servidor rodando na porta ${PORT}`));
