'use strict';
// ───────────────────────── Kacheln ─────────────────────────
// Böden: . Stein, k Kryptastein, c Hallenteppich, b/g/a/r Hausteppiche, s Schnee, p Planken, S Treppe, i Eis
// Blöcke: # Mauer, F Kamin, D verschlossene Tür, h Haustür, B Bücherregal, t Tisch, P Säule, R Felswand
const TILES = {
  '.': { floor: 1 }, k: { floor: 1 }, c: { floor: 1 }, b: { floor: 1 }, g: { floor: 1 }, a: { floor: 1 }, r: { floor: 1 },
  s: { floor: 1 }, p: { floor: 1 }, S: { floor: 1 }, i: { floor: 1 },
  w: { solid: 1, water: 1 },
  '#': { solid: 1, block: 1, h: 54, cut: 1, proj: 1 },
  F: { solid: 1, block: 1, h: 54, cut: 1, proj: 1 },
  D: { solid: 1, block: 1, h: 54, cut: 1, proj: 1 },
  h: { solid: 1, block: 1, h: 54, cut: 1, proj: 1 },
  B: { solid: 1, block: 1, h: 46, cut: 1, proj: 1 },
  t: { solid: 1, block: 1, h: 14 },
  P: { solid: 1, block: 1, h: 64, cut: 1, proj: 1 },
  R: { solid: 1, block: 1, h: 150, proj: 1 },
};
const SOLID_OBJ = { brazier: 1, torch: 1, crate: 1, tree: 1, banner: 1, fountain: 1, cauldron: 1 };

const World = {
  grid: null, objects: [], npcs: [], rooms: [],
  windows: new Set(), falls: new Set(), houseDoors: {}, stairs: {}, dirty: true,
};

function inb(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; }
function T(x, y) { return inb(x, y) ? World.grid[y][x] : x >= MW || y >= MH ? 'w' : 'R'; }
function setT(x, y, c) { if (inb(x, y)) { World.grid[y][x] = c; World.dirty = true; } }
function fill(x1, y1, x2, y2, c) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setT(x, y, c); }
function isFloor(x, y) { const t = TILES[T(x, y)]; return !!(t && t.floor); }

function solidObjAt(tx, ty) {
  for (const o of World.objects) if (SOLID_OBJ[o.type] && o.x === tx && o.y === ty) return o;
  return null;
}
function objAt(tx, ty, type) {
  for (const o of World.objects) if (o.x === tx && o.y === ty && (!type || o.type === type)) return o;
  return null;
}
function npcById(id) { return World.npcs.find((n) => n.id === id); }

function ownDoor(tx, ty) {
  return T(tx, ty) === 'h' && World.houseDoors[tx + ',' + ty] === (G.profile && G.profile.house);
}
function blocked(tx, ty) {
  if (!inb(tx, ty)) return true;
  const t = World.grid[ty][tx];
  if (t === 'h') return !ownDoor(tx, ty);
  if (TILES[t].solid) return true;
  return !!solidObjAt(tx, ty);
}
function roomAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const r of World.rooms) if (tx >= r.x1 && tx <= r.x2 && ty >= r.y1 && ty <= r.y2) return r;
  return null;
}

// ───────────────────────── Karte bauen ─────────────────────────
function buildWorld() {
  const g = [];
  for (let y = 0; y < MH; y++) {
    const row = [];
    for (let x = 0; x < MW; x++) {
      let c = '#';
      if (x <= 1 || y <= 1) c = 'R';
      else if (x >= 46 || y >= 46) c = 'w';
      else if (x >= 42 && y <= 28) c = 'w';
      row.push(c);
    }
    g.push(row);
  }
  World.grid = g;
  World.objects = [];
  World.npcs = [];
  World.windows = new Set();
  World.falls = new Set();
  World.houseDoors = {};
  World.stairs = {};
  World.dirty = true;

  // Räume
  fill(16, 3, 27, 14, 's');                       // Innenhof
  fill(3, 3, 14, 8, '.'); fill(5, 4, 12, 7, 'b');   // Gipfelsturm
  fill(3, 10, 14, 14, '.'); fill(5, 11, 12, 13, 'a'); // Nebelsee
  fill(29, 3, 40, 14, '.');                        // Lagerraum
  fill(3, 16, 14, 27, '.');                        // Bibliothek
  fill(16, 16, 27, 27, '.'); fill(20, 16, 23, 27, 'c'); // Große Halle
  fill(29, 16, 40, 27, '.');                       // Klassenzimmer
  fill(3, 29, 14, 40, 'k');                        // Krypta
  fill(16, 29, 27, 33, '.');                       // Eingangshalle
  fill(16, 35, 21, 40, '.'); fill(17, 36, 20, 39, 'g'); // Wiesengrund
  fill(23, 35, 27, 40, '.'); fill(24, 36, 26, 39, 'r'); // Dünenglut
  fill(29, 29, 45, 41, 's');                       // Bootssteg
  fill(3, 42, 45, 45, 's');                        // Ufer
  fill(36, 37, 45, 45, 'w');                       // Fjordbucht
  fill(42, 42, 43, 43, 's');                       // Insel
  fill(38, 37, 38, 39, 'p');                       // Steg

  // Durchgänge
  fill(21, 15, 22, 15, 'c'); fill(21, 28, 22, 28, 'c');
  fill(15, 21, 15, 22, '.'); fill(28, 21, 28, 22, '.');
  fill(28, 8, 28, 9, '.'); fill(28, 31, 28, 32, '.');
  const hdoor = (x, y, house) => { setT(x, y, 'h'); World.houseDoors[x + ',' + y] = house; };
  hdoor(15, 5, 'gipfelsturm'); hdoor(15, 12, 'nebelsee'); hdoor(18, 34, 'wiesengrund'); hdoor(25, 34, 'duenenglut');

  // Bibliothek & Archiv
  fill(3, 20, 8, 20, '#'); fill(8, 16, 8, 20, '#'); setT(8, 18, 'D');
  fill(3, 16, 7, 16, 'B');
  fill(10, 17, 13, 17, 'B'); fill(10, 19, 13, 19, 'B');
  fill(4, 23, 8, 23, 'B'); fill(4, 25, 8, 25, 'B'); fill(11, 25, 13, 25, 'B');

  // Große Halle
  for (const tx of [17, 19, 24, 26]) fill(tx, 19, tx, 25, 't');
  setT(15, 18, 'F'); setT(18, 15, 'F'); setT(25, 15, 'F');
  setT(16, 16, 'P'); setT(27, 16, 'P');

  // Klassenzimmer
  fill(31, 21, 33, 21, 't'); fill(35, 21, 37, 21, 't'); fill(31, 24, 33, 24, 't'); fill(35, 24, 37, 24, 't');
  fill(38, 25, 40, 27, 'w');

  // Lagerraum: Nische mit Treppe hinter einer Kiste
  fill(36, 3, 36, 7, '#'); fill(36, 8, 40, 8, '#'); setT(36, 5, '.'); setT(39, 4, 'S');

  // Krypta
  fill(7, 29, 7, 37, '#'); fill(11, 32, 11, 40, '#'); setT(3, 29, 'S'); setT(5, 32, 'P'); setT(5, 37, 'P');

  // Eingangshalle
  setT(19, 31, 'P'); setT(24, 31, 'P');

  // Kamine der Gemeinschaftsräume
  setT(8, 2, 'F'); setT(8, 9, 'F'); setT(20, 34, 'F'); setT(27, 34, 'F');

  World.stairs['39,4'] = { x: 4.5, y: 30.5, msg: 'Du steigst die eisigen Stufen in die Krypta hinab …' };
  World.stairs['3,29'] = { x: 37.5, y: 4.5, msg: 'Zurück im Lagerraum. Endlich wieder Licht!' };

  // Fenster mit Wasserfall-Blick (nur Innenräume, nicht die Krypta)
  for (let x = 3; x <= 40; x++) {
    if (x >= 16 && x <= 27) continue;
    if (x % 3 === 1 && T(x, 2) === '#' && isFloor(x, 3)) World.windows.add(x + ',2');
  }
  for (let y = 3; y <= 27; y++) if (y % 3 === 0 && T(2, y) === '#' && isFloor(3, y)) World.windows.add('2,' + y);
  for (const x of [5, 6, 19, 20, 21, 33, 34]) World.falls.add(x + ',1');
  for (const y of [11, 12, 24, 25, 37]) World.falls.add('1,' + y);

  // Räume (Archiv vor Bibliothek, damit es Vorrang hat)
  World.rooms = [
    { name: 'Archiv der Bibliothek', x1: 3, y1: 16, x2: 7, y2: 19, amb: 0.72 },
    { name: 'Innenhof', x1: 16, y1: 3, x2: 27, y2: 14, amb: 0.22, outdoor: true },
    { name: 'Gemeinschaftsraum Gipfelsturm', x1: 3, y1: 3, x2: 14, y2: 8, amb: 0.45, house: 'gipfelsturm' },
    { name: 'Gemeinschaftsraum Nebelsee', x1: 3, y1: 10, x2: 14, y2: 14, amb: 0.48, house: 'nebelsee' },
    { name: 'Lagerraum', x1: 29, y1: 3, x2: 40, y2: 14, amb: 0.6 },
    { name: 'Bibliothek', x1: 3, y1: 16, x2: 14, y2: 27, amb: 0.5 },
    { name: 'Große Halle', x1: 16, y1: 16, x2: 27, y2: 27, amb: 0.38 },
    { name: 'Klassenzimmer für Elementarmagie', x1: 29, y1: 16, x2: 40, y2: 27, amb: 0.45 },
    { name: 'Krypta', x1: 3, y1: 29, x2: 14, y2: 40, amb: 0.97, dark: true },
    { name: 'Eingangshalle', x1: 16, y1: 29, x2: 27, y2: 33, amb: 0.45 },
    { name: 'Gemeinschaftsraum Wiesengrund', x1: 16, y1: 35, x2: 21, y2: 40, amb: 0.42, house: 'wiesengrund' },
    { name: 'Gemeinschaftsraum Dünenglut', x1: 23, y1: 35, x2: 27, y2: 40, amb: 0.42, house: 'duenenglut' },
    { name: 'Bootssteg am Fjord', x1: 29, y1: 29, x2: 45, y2: 41, amb: 0.22, outdoor: true },
    { name: 'Fjordufer', x1: 0, y1: 42, x2: 49, y2: 49, amb: 0.22, outdoor: true },
  ];

  // Objekte
  const O = (type, x, y, p = {}) => {
    const o = Object.assign({ id: `${type}_${x}_${y}`, type, x, y, rx: x, ry: y, seed: Math.random() * 10 }, p);
    World.objects.push(o);
    return o;
  };
  for (const [x, y] of [[18, 5], [25, 5], [18, 12], [25, 12]]) O('brazier', x, y, { lit: false, court: true });
  O('fountain', 21, 9);
  O('tree', 16, 3); O('tree', 27, 3); O('tree', 16, 14);
  const litTorches = [[16, 27], [27, 27], [27, 17], [9, 16], [14, 27], [3, 27], [40, 16], [29, 27], [37, 27],
    [29, 3], [35, 14], [16, 29], [27, 29], [3, 8], [14, 14], [16, 40], [27, 40], [30, 30], [37, 36]];
  for (const [x, y] of litTorches) O('torch', x, y, { lit: true });
  for (const [x, y] of [[5, 35], [9, 30], [9, 38], [13, 33]]) O('torch', x, y, { lit: false });
  O('banner', 17, 18, { house: 'gipfelsturm' }); O('banner', 19, 18, { house: 'wiesengrund' });
  O('banner', 24, 18, { house: 'nebelsee' }); O('banner', 26, 18, { house: 'duenenglut' });
  O('crate', 36, 5, { key: true });
  for (const [x, y] of [[30, 4], [31, 4], [30, 5], [33, 12], [34, 12], [38, 12]]) O('crate', x, y);
  O('cauldron', 39, 17);
  for (const [x, y] of [[10, 43], [14, 44], [20, 43], [25, 44], [5, 42], [44, 30], [43, 33], [31, 44]]) O('tree', x, y);
  O('item', 42, 42, { item: 'perle', name: 'Fjordperle' });
  O('item', 4, 17, { item: 'buch', name: 'Sternenbuch' });
  O('item', 13, 39, { item: 'kristall', name: 'Nordlichtkristall' });
  [[26, 13], [13, 26], [40, 20], [33, 6], [4, 39], [13, 29], [6, 44], [17, 31]].forEach(([x, y], i) => O('rune', x, y, { rid: i }));

  // Figuren
  const N = (p) => {
    const n = Object.assign({ fx: 0.7, fy: 0.7, phase: 0, moving: false, wait: rand(0.5, 3), tx: null, ty: null, speed: 1.1 }, p);
    n.homeX = n.x; n.homeY = n.y;
    World.npcs.push(n);
    return n;
  };
  N({ id: 'direktorin', name: 'Direktorin Silberhorn', x: 22.8, y: 17.4, robe: '#c9d3e0', trim: '#e9d38a', hat: '#2a3242', skin: '#f0d2b8', hair: '#ececf4', staff: true, quest: true, fx: 0.7, fy: 0.7 });
  N({ id: 'frostvik', name: 'Professorin Frostvik', x: 34.5, y: 18.6, robe: '#3a8fb5', trim: '#cff3ff', hat: '#173a4d', skin: '#f3d9c4', hair: '#f4f4ff', quest: true });
  N({ id: 'tintenfjell', name: 'Meister Tintenfjell', x: 11.5, y: 22.5, robe: '#5a3d6b', trim: '#d9b45a', hat: '#2d1f36', skin: '#d9a57c', hair: '#4a4a4a', beard: '#8a8a8a', quest: true });
  N({ id: 'grimnir', name: 'Hausmeister Grimnir', x: 32.5, y: 9.5, robe: '#6b5a3e', trim: '#a68b5b', hat: '#3a2f20', skin: '#c48c66', hair: '#9a9a9a', beard: '#c9c9c9', noHat: true, quest: true });
  N({ id: 'olav', name: 'Olav, der Fjordgeist', x: 23.5, y: 30.5, robe: '#cfe8ff', trim: '#ffffff', hat: '#9ec4e6', skin: '#e8f4ff', hair: '#ffffff', beard: '#ffffff', ghost: true, wander: [16, 17, 27, 32], speed: 0.7 });
  const students = [
    { name: 'Sigrid', house: 'gipfelsturm', area: [16, 17, 27, 27] },
    { name: 'Bjarne', house: 'duenenglut', area: [16, 29, 27, 33] },
    { name: 'Malou', house: 'wiesengrund', area: [16, 17, 27, 27] },
    { name: 'Henrik', house: 'nebelsee', area: [29, 29, 40, 36] },
  ];
  students.forEach((s, i) => {
    const h = HOUSES[s.house];
    N({ id: 'schueler' + i, name: `${s.name} (${h.name})`, x: rand(s.area[0] + 1, s.area[2] - 1), y: rand(s.area[1] + 1, s.area[3] - 1),
      robe: h.color, trim: h.light, hat: h.dark, skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length], wander: s.area, student: true });
  });
  const prefects = [
    { house: 'gipfelsturm', name: 'Erik Steinhauer', t: 'Vertrauensschüler', x: 10.5, y: 5.5 },
    { house: 'nebelsee', name: 'Ylva Nebelhain', t: 'Vertrauensschülerin', x: 10.5, y: 12.6 },
    { house: 'wiesengrund', name: 'Frida Moosgrün', t: 'Vertrauensschülerin', x: 18.5, y: 38.5 },
    { house: 'duenenglut', name: 'Tarek Glutsand', t: 'Vertrauensschüler', x: 25.5, y: 38.5 },
  ];
  prefects.forEach((p) => {
    const h = HOUSES[p.house];
    N({ id: 'prefect_' + p.house, name: `${p.name} (${p.t})`, x: p.x, y: p.y, robe: h.color, trim: '#e9d38a', hat: h.dark,
      skin: SKINS[hash(p.x | 0, p.y | 0) * 5 | 0], hair: HAIRS[hash(p.y | 0, p.x | 0) * 7 | 0], prefect: p.house });
  });
}
