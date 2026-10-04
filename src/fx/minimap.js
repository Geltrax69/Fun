// Feature 11f: minimap — a top-down canvas overlay (top-right) drawn from
// the layout: water, streets, buildings, plus a live player arrow and NPC
// dots. The static layer is prerendered once; markers redraw each frame.
const SIZE = 190;
const WORLD = 720; // world units across the map (x/z in [-360, 360])

const w2m = (v) => ((v + WORLD / 2) / WORLD) * SIZE;

export function createMinimap(layout) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  Object.assign(canvas.style, {
    position: 'fixed', top: '10px', right: '10px', zIndex: 10,
    borderRadius: '10px', border: '2px solid rgba(255,255,255,0.25)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)', pointerEvents: 'none',
    opacity: '0.92',
  });
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');

  // Prerender the static layer.
  const bg = document.createElement('canvas');
  bg.width = bg.height = SIZE;
  const b = bg.getContext('2d');
  b.fillStyle = '#1d2b1a'; // ground
  b.fillRect(0, 0, SIZE, SIZE);
  // Sea + canal water.
  b.fillStyle = '#1e4d6e';
  b.fillRect(0, w2m(150), SIZE, SIZE - w2m(150)); // sea (z > 150)
  const cx = w2m(layout.canal.x);
  b.fillRect(cx - (5 / WORLD) * SIZE, w2m(-350), (10 / WORLD) * SIZE, w2m(150) - w2m(-350));
  // Streets.
  b.strokeStyle = '#3a3a3a';
  b.lineWidth = 3;
  for (const sx of layout.streetsV) {
    b.beginPath(); b.moveTo(w2m(sx), w2m(-150)); b.lineTo(w2m(sx), w2m(150)); b.stroke();
  }
  for (const sz of layout.streetsH) {
    b.beginPath(); b.moveTo(w2m(-150), w2m(sz)); b.lineTo(w2m(150), w2m(sz)); b.stroke();
  }
  // Buildings.
  b.fillStyle = '#8a6f4d';
  for (const h of layout.houses) {
    b.save();
    b.translate(w2m(h.x), w2m(h.z));
    b.rotate(h.rotY);
    b.fillRect(-2.2, -1.6, 4.4, 3.2);
    b.restore();
  }
  // Church + lighthouse landmarks.
  b.fillStyle = '#d8d8e8';
  b.beginPath(); b.arc(w2m(layout.church.x), w2m(layout.church.z), 3, 0, 7); b.fill();
  b.fillStyle = '#e8e86a';
  b.beginPath(); b.arc(w2m(layout.lighthouse.x), w2m(layout.lighthouse.z), 2.5, 0, 7); b.fill();

  function update(player, npcs) {
    g.clearRect(0, 0, SIZE, SIZE);
    g.drawImage(bg, 0, 0);
    // NPC dots (only near the player, to avoid clutter).
    g.fillStyle = '#ffd75e';
    for (const n of npcs) {
      const dx = n.pos.x - player.pos.x;
      const dz = n.pos.z - player.pos.z;
      if (dx * dx + dz * dz > 60 * 60) continue;
      g.fillRect(w2m(n.pos.x) - 1, w2m(n.pos.z) - 1, 2, 2);
    }
    // Player arrow.
    const px = w2m(player.pos.x);
    const py = w2m(player.pos.z);
    g.save();
    g.translate(px, py);
    // Model faces +z at yaw 0; on the map +z is down. rotate() is clockwise.
    g.rotate(Math.PI - player.yaw);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(0, 2); g.lineTo(-4, 4);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  return { update };
}
