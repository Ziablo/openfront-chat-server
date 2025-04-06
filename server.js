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
  // Ne stocker que les messages de type chat ou image
  if (message.type === 'chat') {
    console.log('Stockage d\'un nouveau message:', message);
    lastMessages.push(message);
    if (lastMessages.length > MAX_STORED_MESSAGES) {
      lastMessages.shift();
    }
    console.log('Messages stockés:', lastMessages.length);
  }
}

// Fonction pour envoyer les derniers messages à un client
function sendLastMessages(ws) {
  console.log('Envoi des derniers messages. Nombre de messages:', lastMessages.length);
  if (lastMessages.length > 0) {
    ws.send(JSON.stringify({
      type: 'lastMessages',
      messages: lastMessages
    }));
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

  // Envoyer immédiatement les derniers messages
  sendLastMessages(ws);

  // Gestion des messages reçus
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Message reçu:', message.type);

      if (message.type === 'getLastMessages') {
        sendLastMessages(ws);
        return;
      }

      // Stocker le message
      storeMessage(message);

      // Diffusion du message à tous les autres clients
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
