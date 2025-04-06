# Serveur de Chat OpenFront

Serveur WebSocket pour le chat en jeu de l'extension OpenFront.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm start
```

Le serveur démarrera sur le port 3000 par défaut, ou utilisera le port spécifié dans la variable d'environnement PORT.

## Fonctionnalités

- Communication en temps réel via WebSocket
- Diffusion des messages à tous les clients connectés
- Gestion automatique des déconnexions
- Ping/Pong pour maintenir les connexions actives
