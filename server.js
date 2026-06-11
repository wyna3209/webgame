const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const GRID_SIZE = 5;
let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
const players = new Map();

function broadcastState() {
  const state = {
    type: 'state',
    grid,
    players: Array.from(players.entries()).map(([id, p]) => ({ id, color: p.color, x: p.x, y: p.y }))
  };
  const msg = JSON.stringify(state);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'join') {
      playerId = Math.random().toString(36).slice(2,9);
      const color = msg.color || '#ff0000';
      const x = Math.floor(Math.random()*GRID_SIZE);
      const y = Math.floor(Math.random()*GRID_SIZE);
      players.set(playerId, { color, x, y });
      ws.send(JSON.stringify({ type: 'welcome', id: playerId }));
      broadcastState();
    } else if (msg.type === 'move' && playerId) {
      const p = players.get(playerId);
      if (!p) return;
      const { x, y } = p;
      let nx = x, ny = y;
      if (msg.dir === 'up') ny = Math.max(0, y-1);
      if (msg.dir === 'down') ny = Math.min(GRID_SIZE-1, y+1);
      if (msg.dir === 'left') nx = Math.max(0, x-1);
      if (msg.dir === 'right') nx = Math.min(GRID_SIZE-1, x+1);
      if (Math.abs(nx-x) + Math.abs(ny-y) === 1) {
        p.x = nx; p.y = ny;
        players.set(playerId, p);
        broadcastState();
      }
    } else if (msg.type === 'claim' && playerId) {
      const p = players.get(playerId);
      if (!p) return;
      grid[p.y][p.x] = p.color;
      broadcastState();
    }
  });

  ws.on('close', () => {
    if (playerId) {
      players.delete(playerId);
      broadcastState();
    }
  });

  ws.send(JSON.stringify({ type: 'state', grid, players: Array.from(players.entries()).map(([id,p]) => ({ id, color: p.color, x: p.x, y: p.y })) }));
});

const PORT = process.env.PORT || 3000;

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process using the port or set a different PORT environment variable.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => console.log('Server listening on', PORT));
