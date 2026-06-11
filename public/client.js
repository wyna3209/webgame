const WS = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
let ws = null;
let myId = null;
let grid = [];
let players = [];
let myPos = null; // local predicted position {x,y}
let seq = 0; // input sequence for debugging
const pendingClaims = new Set(); // store 'x,y' strings for optimistic claims

const GRID_SIZE = 5;

const gridEl = document.getElementById('grid');
for (let y=0;y<GRID_SIZE;y++) for (let x=0;x<GRID_SIZE;x++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.x = x; cell.dataset.y = y;
  gridEl.appendChild(cell);
}

function render() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach(c => {
    const x = Number(c.dataset.x), y = Number(c.dataset.y);
    // claimed background
    c.querySelectorAll('.claimed').forEach(n => n.remove());
    const color = (grid[y] && grid[y][x]) ? grid[y][x] : null;
    const key = `${x},${y}`;
    if (color || pendingClaims.has(key)) {
      const div = document.createElement('div'); div.className='claimed';
      div.style.background = color || (players.find(p => p.id === myId) || {}).color || '#000';
      if (pendingClaims.has(key)) div.classList.add('pending');
      c.appendChild(div);
    }
    // remove old player dots
    c.querySelectorAll('.player').forEach(n => n.remove());
  });
  players.forEach(p => {
    const sel = document.querySelector(`.cell[data-x="${p.x}"][data-y="${p.y}"]`);
    if (!sel) return;
    const dot = document.createElement('div');
    dot.className = 'player'; dot.style.background = p.color;
    if (p.id === myId) dot.style.boxShadow = '0 0 0 2px #00000022';
    sel.appendChild(dot);
  });
}

function connect(color) {
  ws = new WebSocket(WS);
  ws.addEventListener('open', () => {
    document.getElementById('status').textContent = '연결됨';
    ws.send(JSON.stringify({ type: 'join', color }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'welcome') { myId = msg.id; }
    if (msg.type === 'state') {
      // server authoritative state
      grid = msg.grid;
      players = msg.players || [];
      // reconcile client-predicted position for this client
      const serverMe = players.find(p => p.id === myId);
      if (serverMe) {
        // if we had a local predicted pos and it differs from server, update
        if (myPos && (serverMe.x !== myPos.x || serverMe.y !== myPos.y)) {
          // correct local position to server
          myPos.x = serverMe.x; myPos.y = serverMe.y;
        } else {
          // if no local pos tracked, initialize from server
          myPos = { x: serverMe.x, y: serverMe.y };
        }
      }
      // clear any pending claim that server has confirmed
      // find cells in grid that match our color and remove from pending
      if (myId) {
        const myColor = (serverMe && serverMe.color) || document.getElementById('color').value;
        for (const k of Array.from(pendingClaims)) {
          const [px, py] = k.split(',').map(Number);
          if (grid[py] && grid[py][px] === myColor) pendingClaims.delete(k);
        }
      }
      // update players array to ensure our local predicted player is shown
      if (myPos && myId) setLocalPlayerPos(myId, myPos.x, myPos.y);
      render();
    }
  });
  ws.addEventListener('close', () => { document.getElementById('status').textContent = '연결끊김'; });
}

document.getElementById('join').addEventListener('click', () => {
  const color = document.getElementById('color').value;
  if (!ws || ws.readyState !== WebSocket.OPEN) connect(color);
});

window.addEventListener('keydown', (e) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  let dir = null;
  if (e.key === 'ArrowUp') dir = 'up';
  if (e.key === 'ArrowDown') dir = 'down';
  if (e.key === 'ArrowLeft') dir = 'left';
  if (e.key === 'ArrowRight') dir = 'right';
  if (dir) { e.preventDefault(); ws.send(JSON.stringify({ type: 'move', dir })); }
  if (e.code === 'Space') { e.preventDefault(); ws.send(JSON.stringify({ type: 'claim' })); }
});

function setLocalPlayerPos(id, x, y) {
  const idx = players.findIndex(p => p.id === id);
  if (idx >= 0) {
    players[idx].x = x; players[idx].y = y;
  } else {
    // create a minimal local player entry (color unknown until server sends)
    players.push({ id, color: document.getElementById('color').value, x, y });
  }
}

// enhance key handler to do client-side prediction and optimistic claim
window.addEventListener('keydown', (e) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  let dir = null;
  if (e.key === 'ArrowUp') dir = 'up';
  if (e.key === 'ArrowDown') dir = 'down';
  if (e.key === 'ArrowLeft') dir = 'left';
  if (e.key === 'ArrowRight') dir = 'right';
  if (dir) {
    e.preventDefault();
    // predict locally
    if (!myPos) return;
    const { x, y } = myPos;
    let nx = x, ny = y;
    if (dir === 'up') ny = Math.max(0, y-1);
    if (dir === 'down') ny = Math.min(GRID_SIZE-1, y+1);
    if (dir === 'left') nx = Math.max(0, x-1);
    if (dir === 'right') nx = Math.min(GRID_SIZE-1, x+1);
    if (Math.abs(nx-x) + Math.abs(ny-y) === 1) {
      myPos.x = nx; myPos.y = ny;
      setLocalPlayerPos(myId, nx, ny);
      render();
      seq += 1;
      ws.send(JSON.stringify({ type: 'move', dir, seq }));
    }
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!myPos) return;
    const key = `${myPos.x},${myPos.y}`;
    pendingClaims.add(key);
    // optimistically update grid locally
    if (!grid[myPos.y]) grid[myPos.y] = Array(GRID_SIZE).fill(null);
    grid[myPos.y][myPos.x] = document.getElementById('color').value;
    render();
    ws.send(JSON.stringify({ type: 'claim', seq: ++seq }));
  }
});
