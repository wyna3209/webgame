const WS = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
let ws = null;
let myId = null;
let grid = [];
let players = [];

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
    if (color) {
      const div = document.createElement('div'); div.className='claimed'; div.style.background = color; c.appendChild(div);
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
      grid = msg.grid;
      players = msg.players || [];
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
