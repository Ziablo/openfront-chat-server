const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const ADMIN_PASSWORD = 'coco132'; // Mot de passe admin stocké sur le serveur
const clients = new Set();
const messages = [];
const MAX_MESSAGES = 5;

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
      clients.delete(ws);
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
    messages.push(message);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    console.log('Messages stockés:', messages.length);
  }
}

// Fonction pour envoyer les derniers messages à un client
function sendLastMessages(ws) {
  console.log('Envoi des derniers messages. Nombre de messages:', messages.length);
  if (messages.length > 0) {
    ws.send(JSON.stringify({
      type: 'lastMessages',
      messages: messages.slice(-MAX_MESSAGES)
    }));
  }
}

// Fonction pour diffuser un message à tous les clients
function broadcast(message, sender) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Nouvelle connexion');
  
  // Envoyer les derniers messages au nouveau client
  if (messages.length > 0) {
    ws.send(JSON.stringify({
      type: 'lastMessages',
      messages: messages.slice(-5) // Envoyer les 5 derniers messages
    }));
  }
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // Ajouter le timestamp du serveur à chaque message
      if (message.type === 'chat') {
        message.serverTimestamp = Date.now();
        messages.push(message);
        
        // Limiter le nombre de messages stockés
        if (messages.length > 100) {
          messages.shift();
        }
      }
      
      // Diffuser le message à tous les clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      console.error('Erreur lors du traitement du message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client déconnecté');
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
