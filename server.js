const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Stockage des connexions actives et des derniers messages
const connections = new Set();
const lastMessages = [];
const MAX_STORED_MESSAGES = 5;

// Route de test pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('Serveur de chat OpenFront en ligne!');
});

// Ping pour garder les connexions actives
function heartbeat() {
  this.isAlive = true;
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      connections.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Fonction pour stocker un nouveau message
function storeMessage(message) {
  if (message.type === 'chat') {
    lastMessages.push(message);
    if (lastMessages.length > MAX_STORED_MESSAGES) {
      lastMessages.shift();
    }
  }
}

wss.on('connection', (ws) => {
  console.log('Nouveau client connecté');
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  connections.add(ws);

  // Envoi d'un message de bienvenue
  ws.send(JSON.stringify({
    type: 'system',
    content: 'Connecté au chat OpenFront'
  }));

  // Gestion des messages reçus
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'getLastMessages') {
        // Envoyer les derniers messages au client qui les demande
        ws.send(JSON.stringify({
          type: 'lastMessages',
          messages: lastMessages
        }));
        return;
      }

      // Stocker le message s'il est de type chat
      storeMessage(message);

      // Diffusion du message à tous les clients connectés
      connections.forEach((client) => {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(data.toString());
        }
      });
    } catch (error) {
      console.error('Erreur lors du traitement du message:', error);
    }
  });

  // Gestion de la déconnexion
  ws.on('close', () => {
    console.log('Client déconnecté');
    connections.delete(ws);
  });
});

wss.on('close', () => {
  clearInterval(interval);
});

// Démarrage du serveur
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Serveur en écoute sur le port ${port}`);
}); 
