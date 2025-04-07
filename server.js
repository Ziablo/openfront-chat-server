const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration secrète
const ADMIN_COMMAND = 'X8k9Y#mP$'; // Commande secrète à remplacer
const JWT_SECRET = 'votre_secret_jwt_super_long_et_complexe'; // Secret JWT à remplacer

// Stockage des messages (limité aux 50 derniers)
const messages = [];
const MAX_MESSAGES = 50;

// Fonction pour vérifier un token JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Endpoint pour vérifier la commande admin
app.post('/admin/verify', (req, res) => {
  const { command } = req.body;
  if (command === `/pourquoi ${ADMIN_COMMAND}`) {
    const token = jwt.sign({ isAdmin: true }, JWT_SECRET);
    res.json({ success: true, token });
  } else {
    res.json({ success: false });
  }
});

// Endpoint pour vérifier un token existant
app.post('/admin/verify-token', (req, res) => {
  const { token } = req.body;
  const decoded = verifyToken(token);
  res.json({ success: !!decoded?.isAdmin });
});

// Gestion des connexions WebSocket
wss.on('connection', (ws, req) => {
  // Vérifier si l'utilisateur est admin via le token
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  ws.isAdmin = !!verifyToken(token)?.isAdmin;

  // Envoyer les derniers messages
  ws.send(JSON.stringify({
    type: 'lastMessages',
    messages: messages
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'chat') {
        // Ajouter un ID unique si non présent
        message.id = message.id || Date.now().toString();
        messages.push(message);
        
        // Garder seulement les 50 derniers messages
        if (messages.length > MAX_MESSAGES) {
          messages.shift();
        }

        // Diffuser le message à tous les clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
      else if (message.type === 'admin' && ws.isAdmin) {
        if (message.action === 'delete') {
          // Supprimer le message du stockage
          const index = messages.findIndex(m => m.id === message.messageId);
          if (index !== -1) {
            messages.splice(index, 1);
          }

          // Informer tous les clients de la suppression
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        }
      }
    } catch (error) {
      console.error('Erreur de traitement du message:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
}); 
