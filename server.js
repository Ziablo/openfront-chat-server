const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Configuration
const ADMIN_COMMAND = '/pourquoi';
const ADMIN_PASSWORD = 'admin123';
const JWT_SECRET = 'votre_secret_jwt'; // À changer en production

// Stockage des messages
const messages = new Map();
const clients = new Set();

// Routes d'authentification
app.post('/admin/verify', (req, res) => {
  const { command } = req.body;
  
  if (command === ADMIN_COMMAND) {
    const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.json({ success: false });
  }
});

app.post('/admin/verify-token', (req, res) => {
  const { token } = req.body;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
});

// Gestion des connexions WebSocket
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  let isAdmin = false;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      isAdmin = decoded.isAdmin;
    } catch (error) {
      console.error('Token invalide:', error);
    }
  }

  ws.isAdmin = isAdmin;
  clients.add(ws);

  // Envoyer les derniers messages
  const lastMessages = Array.from(messages.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-5);
  
  if (lastMessages.length > 0) {
    ws.send(JSON.stringify({
      type: 'lastMessages',
      messages: lastMessages
    }));
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'chat') {
        message.id = Date.now().toString();
        messages.set(message.id, message);
        
        // Limiter le stockage à 100 messages
        if (messages.size > 100) {
          const oldestKey = Array.from(messages.keys())[0];
          messages.delete(oldestKey);
        }

        // Diffuser le message à tous les clients
        broadcast(message);
      } else if (message.type === 'admin' && ws.isAdmin) {
        if (message.action === 'delete') {
          messages.delete(message.messageId);
          broadcast(message);
        } else if (message.action === 'ban') {
          broadcast(message);
        }
      }
    } catch (error) {
      console.error('Erreur de traitement du message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocketServer.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Démarrage du serveur
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Serveur en écoute sur le port ${port}`);
}); 
