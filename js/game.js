'use strict';
// ───────────────────────── Spielzustand ─────────────────────────
const SAVE_KEY = 'silberfjord_save_v1';
const G = {
  state: 'menu', time: 0, profile: null, player: null, known: [], selected: 1,
  quests: {}, inv: {}, points: 0, runes: [], opened: [],
  dialog: null, projectiles: [], particles: [], snow: [],
  amb: 0.35, outdoor: 1, room: null, fade: 0, auroraBoost: 0, castFlash: 0,
  focus: { x: 24, y: 20 }, panel: null, autosave: 0, modal: false,
};
for (let i = 0; i < 140; i++) G.snow.push({ x: Math.random() * 2000, y: Math.random() * 1200, v: rand(18, 45), s: Math.random() < 0.2 ? 2.5 : 1.5, w: rand(0.5, 1.5), ph: rand(0, 6), a: rand(0.4, 0.9) });

const QUESTS = {
  feuer: { title: 'Das Begrüßungsfeuer', giver: 'Direktorin Silberhorn', desc: 'Entzünde mit Ignis die vier Feuerschalen im Innenhof (durch das Nordtor der Großen Halle).' },
  perle: { title: 'Die Fjordperle', giver: 'Professorin Frostvik', item: 'perle', desc: 'Lass mit Glacies einen Eispfad über die Fjordbucht gefrieren und hole die Fjordperle von der kleinen Insel beim Bootssteg.' },
  buch: { title: 'Das Sternenbuch', giver: 'Meister Tintenfjell', item: 'buch', desc: 'Öffne das Archiv in der Bibliothek mit Reserare und bringe das Sternenbuch zurück.' },
  kristall: { title: 'Der Nordlichtkristall', giver: 'Hausmeister Grimnir', item: 'kristall', desc: 'Schiebe die Kiste im Lagerraum mit Ventus beiseite, steige in die Krypta hinab und finde den Nordlichtkristall.' },
  fest: { title: 'Das Nordlichtfest', giver: 'Direktorin Silberhorn', desc: 'Wirke Aurora im Innenhof unter freiem Himmel.' },
};
const ITEM_NAMES = { perle: 'Fjordperle', buch: 'Sternenbuch', kristall: 'Nordlichtkristall' };

const house = () => HOUSES[G.profile.house];
const wand = () => G.profile.wand;
const $ = (id) => document.getElementById(id);

// ───────────────────────── Werte ─────────────────────────
function maxMana() { return 100 + (wand().core === 'eisbaer' ? 25 : 0); }
function manaRegen() { return 9 * (G.profile.house === 'wiesengrund' ? 1.5 : 1); }
function moveSpeed() { return 3.4 * (G.profile.house === 'gipfelsturm' ? 1.2 : 1); }
function spellCost(id) {
  let c = SPELL[id].cost;
  if (G.profile.house === 'nebelsee') c *= 0.75;
  if (id === 'ignis' && wand().core === 'glutstein') c *= 0.6;
  return Math.round(c);
}
function spellRange(id) {
  let r = { ignis: 7, glacies: 6, ventus: 6, reserare: 5 }[id] || 6;
  if (G.profile.house === 'duenenglut') r *= 1.3;
  if (id === 'ventus' && wand().core === 'seeadler') r *= 2;
  return r;
}
const freezeRadius = () => (wand().core === 'gletscher' ? 1.3 : 0.9);
const lumenRadius = () => 250 * (wand().core === 'nordlicht' ? 1.4 : 1);

// ───────────────────────── Effekte & Klang ─────────────────────────
function spawn(p) {
  const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, life: 1, size: 3, color: '#fff', add: true }, p);
  q.max = q.life;
  G.particles.push(q);
  return q;
}
function burst(x, y, z, colors, n, speed = 1.5, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
    spawn(Object.assign({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(20, 120), g: 160, life: rand(0.4, 1), size: rand(2, 4), color: Array.isArray(colors) ? pick(colors) : colors }, opts));
  }
}
let AC = null;
function sfx(type) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const P = { cast: [520, 880, 0.18, 'sine'], fire: [260, 90, 0.3, 'sawtooth'], ice: [1300, 2100, 0.22, 'triangle'], wind: [160, 340, 0.35, 'triangle'],
      open: [392, 784, 0.4, 'square'], pick: [660, 1320, 0.28, 'sine'], fail: [180, 120, 0.18, 'square'], learn: [523, 1568, 0.8, 'sine'],
      step: [90, 60, 0.05, 'triangle'], quest: [440, 1760, 0.9, 'triangle'] }[type] || [440, 440, 0.1, 'sine'];
    const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = P[3]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(type === 'fire' || type === 'open' ? 0.035 : 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + P[2] + 0.02);
  } catch (e) { /* kein Audio */ }
}

// ───────────────────────── UI-Helfer ─────────────────────────
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4200);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}
let bannerTimer = 0;
function showRoomBanner(name) {
  const el = $('room-banner');
  el.textContent = name;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
}

// ───────────────────────── HUD ─────────────────────────
function buildSpellbar() {
  const bar = $('spellbar');
  bar.innerHTML = '';
  SPELLS.forEach((s, i) => {
    const el = document.createElement('button');
    el.className = 'slot';
    el.dataset.i = i;
    el.innerHTML = `<span class="key">${i + 1}</span><span class="ico"></span><span class="nm"></span><span class="cost"></span>`;
    el.addEventListener('click', () => selectSpell(i));
    el.addEventListener('mouseenter', () => showSpellInfo(i));
    el.addEventListener('mouseleave', () => $('spell-info').classList.remove('show'));
    bar.appendChild(el);
  });
  updateSpellbar();
}
function updateSpellbar() {
  document.querySelectorAll('#spellbar .slot').forEach((el) => {
    const i = +el.dataset.i, s = SPELLS[i];
    const known = G.known.includes(s.id);
    el.classList.toggle('locked', !known);
    el.classList.toggle('sel', i === G.selected);
    el.classList.toggle('active', s.id === 'lumen' && G.player && G.player.lumen);
    el.querySelector('.ico').innerHTML = known ? spellIconSVG(s.id, s.id === 'aurora' ? house().light : s.color) : '<span class="lock">✦</span>';
    el.querySelector('.nm').textContent = known ? s.name : '???';
    el.querySelector('.cost').textContent = known ? spellCost(s.id) : '';
  });
}
function showSpellInfo(i) {
  const s = SPELLS[i], el = $('spell-info');
  const known = G.known.includes(s.id);
  el.innerHTML = known
    ? `<b>${s.name}</b> <span class="muted">· ${spellCost(s.id)} Mana</span><br>${s.desc}`
    : `<b>Unbekannter Zauber</b><br><span class="muted">Die Lehrkräfte der Akademie können ihn dir beibringen.</span>`;
  el.classList.add('show');
}
function updateHUD() {
  const hs = house();
  document.documentElement.style.setProperty('--house', hs.color);
  document.documentElement.style.setProperty('--house-light', hs.light);
  $('pc-crest').innerHTML = crestSVG(hs.id, 54);
  $('pc-name').textContent = G.profile.name;
  $('pc-house').textContent = 'Haus ' + hs.name;
  $('pc-points').textContent = G.points + ' Hauspunkte';
  if (G.panel === 'quests') renderQuestPanel();
}
let lastMana = -1;
function updateMana() {
  const p = G.player, m = maxMana();
  const v = Math.floor(p.mana);
  if (v === lastMana) return;
  lastMana = v;
  $('mana-fill').style.width = (p.mana / m) * 100 + '%';
  $('mana-text').textContent = `${v} / ${m}`;
}
function renderQuestPanel() {
  const rows = [];
  for (const id of Object.keys(QUESTS)) {
    const st = G.quests[id];
    if (st === 'none') continue;
    const q = QUESTS[id];
    let prog = '';
    if (st === 'active') {
      if (id === 'feuer') prog = `${litCount()} / 4 Feuerschalen brennen`;
      else if (q.item) prog = G.inv[q.item] ? `✓ ${ITEM_NAMES[q.item]} gefunden – bring sie zu ${q.giver}!` : 'Noch nicht gefunden';
      else prog = 'Im Innenhof wirken';
      if (questReady(id)) prog = `✓ Erledigt – kehre zu ${q.giver} zurück`;
    }
    rows.push(`<div class="quest ${st}"><div class="qt">${st === 'done' ? '✓ ' : '◆ '}${q.title}</div>
      ${st === 'active' ? `<div class="qd">${q.desc}</div><div class="qp">${prog}</div>` : ''}
      <div class="qg">Auftrag von ${q.giver}</div></div>`);
  }
  if (!rows.length) rows.push('<div class="muted">Noch keine Aufgaben. Sprich mit der Direktorin in der Großen Halle.</div>');
  const known = G.known.map((k) => SPELL[k].name).join(', ');
  $('quest-panel').innerHTML = `<h3>Aufgaben</h3>${rows.join('')}
    <div class="sep"></div>
    <div class="qline">Runensteine: <b>${G.runes.length} / 8</b> <span class="muted">(je +10 Punkte)</span></div>
    <div class="qline">Zauber: ${known}</div>
    <div class="qline muted">Zauberstab: ${wandText(wand())}</div>
    <div class="close-hint">[Q] schließen</div>`;
}
function renderHelpPanel() {
  const hs = house();
  $('help-panel').innerHTML = `<h3>Steuerung</h3>
    <table>
      <tr><td>W A S D / Pfeile</td><td>Laufen</td></tr>
      <tr><td>Umschalt</td><td>Rennen</td></tr>
      <tr><td>1 – 6</td><td>Zauber wählen</td></tr>
      <tr><td>Leertaste</td><td>Zauber in Blickrichtung wirken</td></tr>
      <tr><td>Mausklick</td><td>Zauber zur Mausposition wirken</td></tr>
      <tr><td>E</td><td>Sprechen / Dialog weiter</td></tr>
      <tr><td>Q</td><td>Aufgaben</td></tr>
      <tr><td>M</td><td>Karte ein/aus</td></tr>
      <tr><td>H</td><td>Diese Hilfe</td></tr>
    </table>
    <div class="sep"></div>
    <div class="qline"><b>Hausvorteil (${hs.name}):</b> ${hs.bonus}</div>
    <div class="qline"><b>Stabkern (${coreOf(wand()).name}):</b> ${coreOf(wand()).bonus}</div>
    <div class="close-hint">[H] schließen</div>`;
}
function togglePanel(name) {
  G.panel = G.panel === name ? null : name;
  $('quest-panel').classList.toggle('hidden', G.panel !== 'quests');
  $('help-panel').classList.toggle('hidden', G.panel !== 'help');
  if (G.panel === 'quests') renderQuestPanel();
  if (G.panel === 'help') renderHelpPanel();
}

// ───────────────────────── Dialoge ─────────────────────────
function openDialog(npc, pages, onEnd) {
  G.dialog = { npc, pages, i: -1, onEnd, shown: 0, text: '' };
  $('dialog').classList.remove('hidden');
  nextPage();
}
function nextPage() {
  const d = G.dialog;
  d.i++;
  if (d.i >= d.pages.length) {
    G.dialog = null;
    $('dialog').classList.add('hidden');
    if (d.onEnd) d.onEnd();
    return;
  }
  const pg = d.pages[d.i];
  d.text = typeof pg === 'string' ? pg : pg.t;
  d.shown = 0;
  if (typeof pg === 'object' && pg.fn) pg.fn();
  const n = d.npc;
  $('dlg-name').textContent = n.name;
  $('dlg-portrait').style.background = `radial-gradient(circle at 50% 40%, ${n.skin} 0 28%, ${n.hair} 29% 36%, ${n.robe} 37%)`;
  $('dlg-text').textContent = '';
}
function advanceDialog() {
  const d = G.dialog;
  if (!d) return;
  if (d.shown < d.text.length) { d.shown = d.text.length; $('dlg-text').textContent = d.text; return; }
  nextPage();
}

// ───────────────────────── Aufgaben ─────────────────────────
function litCount() { return World.objects.filter((o) => o.type === 'brazier' && o.court && o.lit).length; }
function questReady(id) {
  if (G.quests[id] !== 'active') return false;
  if (id === 'feuer') return litCount() >= 4;
  if (QUESTS[id].item) return !!G.inv[QUESTS[id].item];
  return false;
}
function startQuest(id) {
  if (G.quests[id] !== 'none') return;
  G.quests[id] = 'active';
  sfx('quest');
  toast(`<span class="tag">Neue Aufgabe</span> ${QUESTS[id].title}`, 'quest');
  updateHUD(); save();
}
function completeQuest(id, pts = 50) {
  if (G.quests[id] === 'done') return;
  G.quests[id] = 'done';
  sfx('quest');
  toast(`<span class="tag">Aufgabe erfüllt</span> ${QUESTS[id].title}`, 'quest');
  addPoints(pts);
  const p = G.player;
  burst(p.x, p.y, 40, [house().color, house().light, '#ffffff'], 40, 2);
  save();
}
function addPoints(n) {
  G.points += n;
  toast(`<b>+${n}</b> Punkte für ${house().name}`, 'points');
  updateHUD();
}
function learnSpell(id) {
  if (G.known.includes(id)) return;
  G.known.push(id);
  G.selected = SPELLS.findIndex((s) => s.id === id);
  sfx('learn');
  toast(`<span class="tag">Neuer Zauber</span> ${SPELL[id].name} <span class="muted">[Taste ${G.selected + 1}]</span>`, 'spell');
  const p = G.player;
  burst(p.x, p.y, 30, [SPELL[id].color, '#ffffff'], 50, 1.8, { g: -20 });
  updateSpellbar(); save();
}
function npcMarker(n) {
  if (!G.profile || !n.quest) return '';
  const q = G.quests;
  switch (n.id) {
    case 'direktorin': {
      if (q.feuer === 'none') return '!';
      if (questReady('feuer')) return '?';
      const all = ['feuer', 'perle', 'buch', 'kristall'].every((k) => q[k] === 'done');
      if (all && q.fest === 'none') return '!';
      return '';
    }
    case 'frostvik': return q.perle === 'none' ? '!' : questReady('perle') ? '?' : '';
    case 'tintenfjell': return q.buch === 'none' ? '!' : questReady('buch') ? '?' : '';
    case 'grimnir': return q.kristall === 'none' ? '!' : questReady('kristall') ? '?' : '';
  }
  return '';
}

function talkTo(n) {
  const p = G.player;
  const dx = p.x - n.x, dy = p.y - n.y, l = Math.hypot(dx, dy) || 1;
  n.fx = dx / l; n.fy = dy / l; n.wait = 4; n.moving = false;
  const name = G.profile.name, hs = house();
  const q = G.quests;
  switch (n.id) {
    case 'direktorin': {
      if (q.feuer === 'none') {
        return openDialog(n, [
          `Willkommen in der Akademie Silberfjord für Zauberkunst, ${name}! Ich bin Ingrid Silberhorn, die Direktorin dieser ehrwürdigen Burg.`,
          'Seit tausend Wintern trotzen diese Mauern dem Eis des Fjords. Unsere Türme sind tief in den Berg gehauen, Wasserfälle stürzen an den Fenstern vorbei – und nachts tanzen die Nordlichter über allem.',
          `Wie ich sehe, hat dich ein ganz besonderer Stab erwählt: ${wandText(wand())}. Gib gut auf ihn acht.`,
          `Und du gehörst nun zum Haus ${hs.name} – ${hs.traits.join(', ')}. Dein Gemeinschaftsraum öffnet sich nur für dich und deine Hausgefährten.`,
          'Zwei Zauber beherrschst du bereits: Lumen [1] für Licht und Ignis [2] für Feuer. Wähle sie mit den Zahlentasten und wirke sie mit der Leertaste in Blickrichtung oder per Mausklick.',
          'Deine erste Aufgabe: Entzünde die vier Feuerschalen im Innenhof – er liegt hinter dem Nordtor dieser Halle. Dann brennt unser Begrüßungsfeuer für das neue Schuljahr!',
        ], () => { startQuest('feuer'); G.selected = 1; updateSpellbar(); });
      }
      if (q.feuer === 'active') {
        if (questReady('feuer')) {
          return openDialog(n, [
            `Ich sehe den Feuerschein bis hierher – das Begrüßungsfeuer brennt! Hervorragend, ${name}.`,
            { t: `Fünfzig Punkte für ${hs.name}!`, fn: () => completeQuest('feuer') },
            'Nun solltest du die anderen Lehrkräfte kennenlernen: Professorin Frostvik unterrichtet im Klassenzimmer östlich der Halle, Meister Tintenfjell hütet die Bibliothek im Westen, und Hausmeister Grimnir werkelt im Lagerraum neben dem Innenhof.',
            'Jeder von ihnen bringt dir einen neuen Zauber bei – und hat eine Aufgabe für dich. Ein goldenes ! zeigt dir, wer etwas von dir möchte.',
          ]);
        }
        return openDialog(n, [`Erst ${litCount()} von 4 Feuerschalen brennen. Wähle Ignis mit der Taste 2 und richte den Zauber auf die Schalen im Innenhof – hinter dem Nordtor der Halle.`]);
      }
      const main = ['perle', 'buch', 'kristall'];
      const allDone = main.every((k) => q[k] === 'done');
      if (allDone && q.fest === 'none') {
        return openDialog(n, [
          `Die Fjordperle, das Sternenbuch, der Nordlichtkristall und das Begrüßungsfeuer – du hast Großes geleistet, ${name}!`,
          { t: 'Zeit für das Nordlichtfest. Ich lehre dich den ältesten Zauber unserer Akademie: Aurora. Sprich ihn mit offenem Herzen.', fn: () => learnSpell('aurora') },
          `Geh hinaus in den Innenhof und wirke Aurora [6] unter freiem Himmel, damit die Nordlichter in den Farben von ${hs.name} erstrahlen!`,
        ], () => startQuest('fest'));
      }
      if (q.fest === 'active') return openDialog(n, ['Der Innenhof wartet! Wirke Aurora [6] unter freiem Himmel.']);
      if (q.fest === 'done') return openDialog(n, [`${name}, du hast dem Haus ${hs.name} große Ehre gemacht. Die Burg gehört dir – erkunde sie, so lange du willst. Vielleicht findest du noch ein paar Runensteine?`]);
      const open = main.filter((k) => q[k] !== 'done').map((k) => QUESTS[k].giver);
      return openDialog(n, [`Du machst dich gut, ${name}. Noch warten ${open.join(', ').replace(/, ([^,]*)$/, ' und $1')} auf deine Hilfe. Danach feiern wir gemeinsam das Nordlichtfest.`]);
    }
    case 'frostvik':
      return teacher(n, 'perle', [
        'Ah, ein neues Gesicht! Ich bin Professorin Sólveig Frostvik und unterrichte Elementarmagie.',
        { t: 'Hier im Norden ist das Eis unser treuester Verbündeter. Ich lehre dich Glacies – sprich es klar und kühl: Gla-ci-es!', fn: () => learnSpell('glacies') },
        'Auf der kleinen Insel draußen in der Fjordbucht liegt eine Fjordperle, die mir die Möwen stibitzt haben. Friere dir mit Glacies einen Eispfad über das Wasser und bring sie mir!',
        'Du erreichst den Bootssteg über die Eingangshalle südlich der Großen Halle. Üben kannst du gleich hier am Wasserbecken – und Ignis schmilzt das Eis wieder.',
      ], 'Die Fjordperle! Sie schimmert wie das Nordlicht selbst. Dafür gibt es fünfzig Punkte!',
      'Die Insel liegt draußen in der Fjordbucht beim Bootssteg. Friere das Wasser mit Glacies [3] – Stück für Stück.',
      'Dein Glacies wird jeden Tag sauberer. Vergiss nicht: Eis ist geduldig – sei es auch.');
    case 'tintenfjell':
      return teacher(n, 'buch', [
        'Pssst! Dies ist eine Bibliothek. Ich bin Meister Halvard Tintenfjell, Hüter der Bücher.',
        'Das Sternenbuch, ein uraltes Werk über die Nordlichter, liegt im Archiv. Nur … habe ich den Schlüssel beim Eisfischen im Fjord verloren. Peinlich, peinlich.',
        { t: 'Zum Glück gibt es Reserare, den Öffnungszauber. Ich lehre ihn dir – aber nur für gute Zwecke, versprochen?', fn: () => learnSpell('reserare') },
        'Die Archivtür liegt im hinteren Teil der Bibliothek, links von hier. Richte Reserare [5] auf das goldene Schloss.',
      ], 'Das Sternenbuch! Unversehrt! Fünfzig Punkte – und bitte, blättere leise.',
      'Das Archiv ist hinten in der Bibliothek. Reserare [5] auf das Schloss – dann hol das Sternenbuch.',
      'Wusstest du, dass manche Bücher hier nur bei Nordlicht lesbar sind? Faszinierend, nicht wahr?');
    case 'grimnir':
      return teacher(n, 'kristall', [
        'Hm? Ein Erstklässler im Lager? Ich bin Grimnir, Hausmeister dieser Burg seit dreihundert Wintern.',
        'Unten in der Krypta liegt der Nordlichtkristall. Er lässt die Lichter über der Burg tanzen – und zum Fest gehört er in die Große Halle.',
        { t: 'Nur steht meine Kiste vor der Treppe, und mein Rücken … Ich zeig dir Ventus, den Windzauber. Damit schiebst du jede Kiste beiseite.', fn: () => learnSpell('ventus') },
        'Die Treppe liegt in der Nische hinten im Lager. Stell dich vor die Kiste und blas sie weg. Und nimm Lumen [1] mit – da unten ist es finster wie in einem Bärenmagen. Fackeln kannst du mit Ignis anzünden.',
      ], 'Der Kristall! Spürst du, wie er summt? Fünfzig Punkte für dein Haus!',
      'Die Kiste steht vor der Nische mit der Treppe. Ventus [4] – und dann hinab. Lumen nicht vergessen!',
      'Wenn du noch Kisten verschieben willst – nur zu. Aber stell sie mir nicht vor die Tür!');
    case 'olav':
      return openDialog(n, [pick([
        'Huuuh … oh, Verzeihung. Alte Gewohnheit. Ich bin Olav, der Fjordgeist.',
        'Vor vierhundert Jahren bin ich beim Eisfischen … nun ja. Reden wir nicht darüber.',
        'Kisten lassen sich mit Ventus schieben – aber nur, wenn dahinter Platz ist. Glaub mir, ich habe es oft beobachtet.',
        'In der Krypta brauchst du Licht. Viel Licht. Lumen und ein paar Fackeln wirken Wunder.',
        'Acht Runensteine sind in der Burg verborgen. Ich habe sie alle gesehen. Verraten? Niemals! Na gut: Einer liegt draußen am Ufer.',
        'Siehst du die Wasserfälle vor den Fenstern? In besonders kalten Nächten frieren sie mitten im Fall ein. Dann klingt die ganze Burg wie ein Glockenspiel.',
      ])]);
    default:
      if (n.prefect) return prefectTalk(n);
      if (n.student) return openDialog(n, [pick([
        'Hast du schon die Wasserfälle vor den Fenstern gesehen? Wunderschön, oder?',
        'Ich hab gehört, in der Krypta spukt es. Aber nur ein bisschen.',
        'Die Nordlichter sind heute wieder grün. Grün heißt Glück, sagt meine Oma.',
        'Professorin Frostvik hat mir aus Versehen die Augenbrauen eingefroren. Glaube ich zumindest.',
        'Für jeden Runenstein bekommt dein Haus zehn Punkte! Ich hab noch keinen gefunden …',
        'Meister Tintenfjell hört angeblich jedes umgeblätterte Blatt – selbst durch drei Wände.',
        'Hausmeister Grimnir ist dreihundert Winter alt. Er sagt, er war früher noch grummeliger.',
      ])]);
  }
}
function teacher(n, qid, intro, doneLine, activeLine, afterLine) {
  const st = G.quests[qid];
  if (st === 'none') return openDialog(n, intro, () => startQuest(qid));
  if (st === 'active') {
    if (questReady(qid)) return openDialog(n, [{ t: doneLine, fn: () => completeQuest(qid) }, 'Die Direktorin wird stolz auf dich sein.']);
    return openDialog(n, [activeLine]);
  }
  return openDialog(n, [afterLine]);
}
function prefectTalk(n) {
  const name = G.profile.name;
  if (n.prefect !== G.profile.house) return openDialog(n, ['Was machst du denn hier? Na gut … setz dich ans Feuer, aber nur kurz.']);
  const lines = {
    gipfelsturm: `Willkommen im Turmzimmer von Gipfelsturm, ${name}! Von hier oben sieht man bei klarem Himmel bis ans Ende des Fjords. Wer rastet, der rostet – auf zum nächsten Gipfel!`,
    wiesengrund: `Komm rein, ${name}, setz dich ans Feuer! Es gibt heißen Blaubeertee und Zimtschnecken. Bei Wiesengrund ist niemand allein.`,
    nebelsee: `Leise, bitte – hier wird nachgedacht. Willkommen, ${name}. Am Fenster siehst du den Nebel über dem See tanzen. Er verrät dem Geduldigen so manches Geheimnis.`,
    duenenglut: `Ah, Verstärkung! Willkommen, ${name}. Unsere Gründerin kam aus den Wüsten des Südens und hat selbst im ewigen Eis überlebt. Wir geben niemals auf.`,
  };
  return openDialog(n, [lines[n.prefect], 'Ruh dich ruhig aus – am Kamin regeneriert sich dein Mana besonders schnell.'], () => {
    G.player.mana = maxMana();
    toast('Dein Mana ist vollständig aufgefüllt.');
  });
}

// ───────────────────────── Zauber ─────────────────────────
function selectSpell(i) {
  const s = SPELLS[i];
  if (!G.known.includes(s.id)) { toast('Diesen Zauber hast du noch nicht gelernt.'); sfx('fail'); return; }
  G.selected = i;
  updateSpellbar();
}
function cast(id, dx, dy) {
  const p = G.player;
  if (!G.known.includes(id)) return;
  if (id === 'lumen' && p.lumen) { p.lumen = false; sfx('cast'); updateSpellbar(); return; }
  const cost = spellCost(id);
  if (p.mana < cost) { toast('Nicht genug Mana – warte einen Moment.'); sfx('fail'); return; }
  p.mana -= cost;
  G.castFlash = 1;
  const col = SPELL[id].color, core = coreOf(wand()).color;
  if (id === 'lumen') {
    p.lumen = true; p.orb = { x: p.x, y: p.y };
    burst(p.x, p.y, 40, [col, core], 24, 1.2, { g: -30 });
    sfx('cast'); updateSpellbar(); return;
  }
  if (id === 'aurora') return castAurora();
  G.projectiles.push({ id, x: p.x + dx * 0.4, y: p.y + dy * 0.4, dx, dy, dist: 0, max: spellRange(id), speed: id === 'ventus' ? 11 : 9,
    ptx: Math.floor(p.x), pty: Math.floor(p.y), color: col, core });
  sfx({ ignis: 'fire', glacies: 'ice', ventus: 'wind', reserare: 'cast' }[id]);
}
function castAurora() {
  const p = G.player, hs = house();
  G.auroraBoost = 1.6;
  sfx('learn');
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      spawn({ x: p.x + rand(-2, 2), y: p.y + rand(-2, 2), z: 20, vz: rand(240, 320), g: 120, life: rand(0.9, 1.3), size: 5, color: hs.light, rocket: true });
    }, i * 260);
  }
  if (G.quests.fest === 'active') {
    if (G.room && G.room.outdoor && G.room.name === 'Innenhof') setTimeout(finishGame, 3200);
    else toast('Aurora entfaltet sich am schönsten im Innenhof unter freiem Himmel.');
  }
}
function freezeAround(x, y) {
  const r = freezeRadius();
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (T(tx, ty) !== 'w' || !inb(tx, ty)) continue;
      if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
      setT(tx, ty, 'i');
      burst(tx + 0.5, ty + 0.5, 4, ['#dff8ff', '#9fe8ff'], 5, 0.6, { g: 80, vz: rand(20, 60) });
    }
  }
}
function updateProjectile(pr, dt) {
  let remaining = pr.speed * dt;
  const p = G.player;
  if (Math.random() < 0.9) spawn({ x: pr.x, y: pr.y, z: 22 + rand(-3, 3), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(-10, 10), life: rand(0.25, 0.5), size: rand(2, 4), color: Math.random() < 0.65 ? pr.color : pr.core });
  while (remaining > 0) {
    const st = Math.min(0.08, remaining);
    remaining -= st;
    pr.x += pr.dx * st; pr.y += pr.dy * st; pr.dist += st;
    const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
    if (!inb(tx, ty)) return false;
    if (pr.id === 'glacies') freezeAround(pr.x, pr.y);
    if (pr.id === 'ignis' && T(tx, ty) === 'i' && Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > 1.1) {
      setT(tx, ty, 'w');
      burst(tx + 0.5, ty + 0.5, 6, ['#ffffff', '#cfe8ff'], 14, 0.8, { add: false, g: -40, vz: 30, size: 6, life: 1.2 });
      return false;
    }
    const o = solidObjAt(tx, ty);
    if (o) { hitObject(pr, o, tx, ty); return false; }
    const t = T(tx, ty);
    if (TILES[t].proj && !(t === 'h' && ownDoor(tx, ty))) { hitTile(pr, t, tx, ty); return false; }
    pr.ptx = tx; pr.pty = ty;
    if (pr.dist >= pr.max) {
      burst(pr.x, pr.y, 22, [pr.color, pr.core], 10, 0.8);
      return false;
    }
  }
  return true;
}
function hitObject(pr, o, tx, ty) {
  burst(pr.x, pr.y, 22, [pr.color, pr.core, '#ffffff'], 16, 1.2);
  if (pr.id === 'ignis' && (o.type === 'brazier' || o.type === 'torch')) {
    if (!o.lit) {
      o.lit = true;
      burst(tx + 0.5, ty + 0.5, 25, ['#ffb347', '#ff7b2e', '#ffe08a'], 30, 1.4, { g: -60 });
      sfx('fire');
      if (o.court && G.quests.feuer === 'active') {
        const c = litCount();
        toast(c >= 4 ? 'Alle vier Feuerschalen brennen! Kehre zur Direktorin zurück.' : `Feuerschale entzündet (${c} / 4)`);
        if (G.panel === 'quests') renderQuestPanel();
      }
      save();
    }
  } else if (pr.id === 'glacies' && (o.type === 'brazier' || o.type === 'torch') && o.lit) {
    o.lit = false;
    burst(tx + 0.5, ty + 0.5, 28, ['#ffffff', '#cfe8ff'], 18, 0.6, { add: false, g: -40, vz: 30, size: 6, life: 1.4 });
    if (o.court && G.quests.feuer === 'active') toast(`Oh nein – die Feuerschale ist erloschen (${litCount()} / 4)`);
  } else if (pr.id === 'ventus' && o.type === 'crate') {
    let ddx = 0, ddy = 0;
    if (pr.ptx !== tx && pr.pty === ty) ddx = Math.sign(tx - pr.ptx);
    else if (pr.pty !== ty && pr.ptx === tx) ddy = Math.sign(ty - pr.pty);
    else if (Math.abs(pr.dx) >= Math.abs(pr.dy)) ddx = Math.sign(pr.dx);
    else ddy = Math.sign(pr.dy);
    pushCrate(o, ddx, ddy);
  } else if (pr.id === 'ventus' && o.type === 'tree') {
    burst(tx + 0.5, ty + 0.5, 50, ['#ffffff', '#e6f0f7'], 30, 1.4, { add: false, g: 60, size: 3, life: 1.4 });
  }
}
function crateBlocked(tx, ty) {
  if (!inb(tx, ty)) return true;
  const t = T(tx, ty);
  if (TILES[t].solid || t === 'S') return true;
  if (objAt(tx, ty)) return true;
  const p = G.player;
  if (Math.floor(p.x) === tx && Math.floor(p.y) === ty) return true;
  return false;
}
function pushCrate(o, ddx, ddy) {
  let nx = o.x, ny = o.y, moved = 0;
  while (moved < 14 && !crateBlocked(nx + ddx, ny + ddy)) { nx += ddx; ny += ddy; moved++; }
  if (!moved) { toast('Die Kiste rührt sich nicht – dahinter ist kein Platz.'); return; }
  o.x = nx; o.y = ny;
  sfx('wind');
  if (o.key) { toast('Die Kiste schlittert beiseite – der Weg zur Treppe ist frei!'); o.key = false; }
  save();
}
function hitTile(pr, t, tx, ty) {
  burst(pr.x - pr.dx * 0.2, pr.y - pr.dy * 0.2, 22, [pr.color, pr.core], 14, 1);
  if (pr.id !== 'reserare') return;
  if (t === 'D') {
    setT(tx, ty, '.');
    G.opened.push(tx + ',' + ty);
    burst(tx + 0.5, ty + 0.5, 30, ['#ffd86b', '#fff2c0'], 40, 1.6);
    sfx('open');
    toast('Klick! Das Schloss springt auf.');
    save();
  } else if (t === 'h') {
    const hs = HOUSES[World.houseDoors[tx + ',' + ty]];
    toast(`Die Tür von Haus ${hs.name} erkennt dich nicht. Nur Mitglieder dürfen hinein.`);
    sfx('fail');
  }
}

// ───────────────────────── Interaktion ─────────────────────────
function nearestNpc(maxD = 1.6) {
  const p = G.player;
  let best = null, bd = maxD;
  for (const n of World.npcs) {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function interact() {
  const n = nearestNpc();
  if (n) talkTo(n);
}
function pickups() {
  const p = G.player;
  for (let i = World.objects.length - 1; i >= 0; i--) {
    const o = World.objects[i];
    if (o.type !== 'item' && o.type !== 'rune') continue;
    if (Math.hypot(o.x + 0.5 - p.x, o.y + 0.5 - p.y) > 0.6) continue;
    World.objects.splice(i, 1);
    sfx('pick');
    if (o.type === 'rune') {
      G.runes.push(o.rid);
      burst(o.x + 0.5, o.y + 0.5, 12, ['#78f0ff', '#ffffff'], 30, 1.4, { g: -40 });
      toast(`Runenstein gefunden (${G.runes.length} / 8)`);
      addPoints(10);
    } else {
      G.inv[o.item] = true;
      burst(o.x + 0.5, o.y + 0.5, 24, ['#ffffff', '#ffd86b', '#7dffc4'], 40, 1.6, { g: -30 });
      const qid = Object.keys(QUESTS).find((k) => QUESTS[k].item === o.item);
      toast(`<span class="tag">Gefunden</span> ${o.name}` + (G.quests[qid] === 'active' ? ` – bring es zu ${QUESTS[qid].giver}!` : ''), 'quest');
      if (G.panel === 'quests') renderQuestPanel();
    }
    save();
  }
}

// ───────────────────────── NPC-Bewegung ─────────────────────────
function updateNpc(n, dt) {
  if (!n.wander) { n.moving = false; return; }
  if (G.dialog && G.dialog.npc === n) { n.moving = false; return; }
  if (n.wait > 0) { n.wait -= dt; n.moving = false; return; }
  if (n.tx === null) {
    const [x1, y1, x2, y2] = n.wander;
    for (let k = 0; k < 10; k++) {
      const tx = Math.floor(rand(x1, x2 + 1)), ty = Math.floor(rand(y1, y2 + 1));
      if (n.ghost || !blocked(tx, ty)) { n.tx = tx + 0.5; n.ty = ty + 0.5; break; }
    }
    if (n.tx === null) { n.wait = 1; return; }
  }
  const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
  if (d < 0.1) { n.tx = null; n.wait = rand(1.5, 5); n.moving = false; return; }
  const vx = (dx / d) * n.speed * dt, vy = (dy / d) * n.speed * dt;
  const nx = n.x + vx, ny = n.y + vy;
  if (!n.ghost && blocked(Math.floor(nx), Math.floor(ny))) { n.tx = null; n.wait = rand(0.3, 1.5); return; }
  n.x = nx; n.y = ny; n.fx = dx / d; n.fy = dy / d; n.moving = true; n.phase += dt * 6;
}

// ───────────────────────── Bewegung ─────────────────────────
const keys = {};
function blockedBox(x, y, r) {
  return blocked(Math.floor(x - r), Math.floor(y - r)) || blocked(Math.floor(x + r), Math.floor(y - r)) ||
    blocked(Math.floor(x - r), Math.floor(y + r)) || blocked(Math.floor(x + r), Math.floor(y + r));
}
function tryMove(p, dx, dy) {
  const r = 0.22;
  if (!blockedBox(p.x + dx, p.y, r)) p.x += dx;
  if (!blockedBox(p.x, p.y + dy, r)) p.y += dy;
}
function camTarget(x, y) { return { x: (x - y) * 32, y: (x + y) * 16 - 26 }; }
function snapCam() { const c = camTarget(G.player.x, G.player.y); cam.x = c.x; cam.y = c.y; }

// ───────────────────────── Update ─────────────────────────
function update(dt) {
  G.time += dt;
  G.castFlash = Math.max(0, G.castFlash - dt * 4);
  G.auroraBoost = Math.max(0, G.auroraBoost - dt / 12);
  G.fade = Math.max(0, G.fade - dt * 1.4);
  $('fade').style.opacity = G.fade;

  if (G.state === 'menu') {
    const t = G.time * 0.05;
    G.focus = { x: 25 + Math.cos(t) * 9, y: 21 + Math.sin(t) * 9 };
    const c = camTarget(G.focus.x, G.focus.y);
    cam.x = c.x; cam.y = c.y;
    G.amb = 0.3; G.outdoor = 1;
    updateParticles(dt);
    return;
  }
  const p = G.player;
  p.mana = Math.min(maxMana(), p.mana + manaRegen() * dt);
  let mx = 0, my = 0;
  if (!G.dialog && !G.modal) {
    if (keys.w || keys.arrowup) { mx -= 1; my -= 1; }
    if (keys.s || keys.arrowdown) { mx += 1; my += 1; }
    if (keys.a || keys.arrowleft) { mx -= 1; my += 1; }
    if (keys.d || keys.arrowright) { mx += 1; my -= 1; }
  }
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    const sp = moveSpeed() * (keys.shift ? 1.6 : 1);
    p.fx = mx; p.fy = my;
    tryMove(p, mx * sp * dt, my * sp * dt);
    p.moving = true; p.phase += dt * sp * 3.2;
  } else p.moving = false;

  // Lumen-Licht folgt
  if (p.lumen) { p.orb.x = lerp(p.orb.x, p.x + 0.45, 1 - Math.exp(-dt * 4)); p.orb.y = lerp(p.orb.y, p.y - 0.45, 1 - Math.exp(-dt * 4)); }

  pickups();
  // Treppen
  const key = Math.floor(p.x) + ',' + Math.floor(p.y);
  if (key !== p.lastTile) {
    p.lastTile = key;
    const s = World.stairs[key];
    if (s) {
      p.x = s.x; p.y = s.y; p.lastTile = Math.floor(s.x) + ',' + Math.floor(s.y);
      if (p.lumen) p.orb = { x: p.x, y: p.y };
      G.fade = 1; snapCam(); toast(s.msg);
      const nr = roomAt(p.x, p.y); if (nr) G.amb = nr.amb;
    }
  }
  // Räume
  const r = roomAt(p.x, p.y);
  if (r && r !== G.room) {
    G.room = r;
    showRoomBanner(r.name);
    if (r.house && r.house === G.profile.house && !G.visitedHome) { G.visitedHome = true; toast(`Willkommen daheim! ${house().room}`); }
  }
  const amb = G.room ? G.room.amb : 0.22;
  G.amb = lerp(G.amb, amb, 1 - Math.exp(-dt * 3));
  G.outdoor = lerp(G.outdoor, G.room && G.room.outdoor ? 1 : 0, 1 - Math.exp(-dt * 3));

  for (const n of World.npcs) updateNpc(n, dt);
  G.projectiles = G.projectiles.filter((pr) => updateProjectile(pr, dt));
  for (const o of World.objects) {
    if (o.type !== 'crate') continue;
    const dx = o.x - o.rx, dy = o.y - o.ry, d = Math.hypot(dx, dy);
    if (d < 0.01) { o.rx = o.x; o.ry = o.y; continue; }
    const st = Math.min(d, dt * 9);
    o.rx += (dx / d) * st; o.ry += (dy / d) * st;
    if (Math.random() < 0.5) spawn({ x: o.rx + 0.5, y: o.ry + 0.5, z: 2, vz: 20, life: 0.6, size: 4, add: false, color: '#c8b8a0' });
  }
  // Funken aus Feuern
  for (const o of World.objects) {
    if ((o.type === 'brazier' || o.type === 'torch') && o.lit && Math.random() < (o.type === 'brazier' ? 0.25 : 0.06)) {
      if (Math.abs(o.x - p.x) + Math.abs(o.y - p.y) > 16) continue;
      spawn({ x: o.x + 0.5 + rand(-0.1, 0.1), y: o.y + 0.5 + rand(-0.1, 0.1), z: o.type === 'brazier' ? 30 : 48, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), vz: rand(30, 70), life: rand(0.5, 1.1), size: 2, color: pick(['#ffb347', '#ffd27a', '#ff7b2e']) });
    }
  }
  updateParticles(dt);

  // Kamera
  G.focus = { x: p.x, y: p.y };
  const c = camTarget(p.x, p.y);
  const k = 1 - Math.exp(-dt * 7);
  cam.x = lerp(cam.x, c.x, k); cam.y = lerp(cam.y, c.y, k);

  // Dialog-Schreibmaschine
  if (G.dialog && G.dialog.shown < G.dialog.text.length) {
    G.dialog.shown = Math.min(G.dialog.text.length, G.dialog.shown + dt * 60);
    $('dlg-text').textContent = G.dialog.text.slice(0, Math.floor(G.dialog.shown));
  }
  // Hinweis
  const n = !G.dialog && nearestNpc();
  const pr = $('prompt');
  if (n) { pr.innerHTML = `<kbd>E</kbd> Sprechen mit ${n.name}`; pr.classList.add('show'); } else pr.classList.remove('show');

  updateMana();
  G.autosave += dt;
  if (G.autosave > 15) { G.autosave = 0; save(); }
}
function updateParticles(dt) {
  const born = [];
  for (const q of G.particles) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= q.g * dt; q.life -= dt;
    if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; }
    if (q.rocket) {
      if (Math.random() < 0.8) born.push({ x: q.x, y: q.y, z: q.z, vz: -20, life: 0.5, size: 2.5, color: '#fff3c0' });
      if (q.life <= 0) {
        const hs = house();
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, s = rand(0.6, 2.6);
          born.push({ x: q.x, y: q.y, z: q.z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(-120, 120), g: 70, life: rand(1, 2), size: rand(2.5, 4.5), color: pick([hs.color, hs.light, '#ffffff', '#7dffc4']) });
        }
        sfx('pick');
      }
    }
  }
  G.particles = G.particles.filter((q) => q.life > 0);
  for (const b of born) spawn(b);
  if (G.particles.length > 1400) G.particles.splice(0, G.particles.length - 1400);
}

// ───────────────────────── Render ─────────────────────────
function render(dt) {
  drawSky(G.time);
  const lights = renderWorld(G.time);
  if (G.player && G.state !== 'menu') {
    const p = G.player;
    const X = sx(p.x, p.y), Y = sy(p.x, p.y);
    lights.push({ x: X, y: Y - 22, r: 95, i: 0.75 });
    if (p.lumen) {
      lights.push({ x: sx(p.orb.x, p.orb.y), y: sy(p.orb.x, p.orb.y) - 54, r: lumenRadius(), i: 1, c: 'rgba(190,225,255,0.10)' });
    }
    for (const pr of G.projectiles) lights.push({ x: sx(pr.x, pr.y), y: sy(pr.x, pr.y) - 22, r: 120, i: 0.9 });
    if (G.castFlash > 0) lights.push({ x: X, y: Y - 30, r: 140 * G.castFlash, i: 0.8 });
  }
  drawLighting(lights, G.time);
  drawParticles();
  drawProjectiles();
  drawLumenOrb(G.time);
  drawLabels(G.time);
  drawSnow(dt);
  if (G.state !== 'menu' && !$('minimap').classList.contains('hidden')) drawMinimap($('minimap'), G.time);
}

// ───────────────────────── Speichern ─────────────────────────
function save() {
  if (!G.profile || !G.player || G.state === 'menu') return;
  const ice = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (World.grid[y][x] === 'i') ice.push([x, y]);
  const data = {
    v: 1, profile: G.profile, known: G.known, selected: G.selected, quests: G.quests, inv: G.inv, points: G.points,
    runes: G.runes, opened: G.opened, ice, visitedHome: !!G.visitedHome,
    lit: World.objects.filter((o) => o.type === 'brazier' || o.type === 'torch').map((o) => [o.id, o.lit]),
    crates: World.objects.filter((o) => o.type === 'crate').map((o) => [o.id, o.x, o.y, !!o.key]),
    pos: { x: G.player.x, y: G.player.y }, lumen: G.player.lumen,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* voll / privat */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function makePlayer(x, y) {
  return { x, y, fx: -0.7071, fy: -0.7071, moving: false, phase: 0, mana: 100, lumen: false, orb: { x, y }, lastTile: '' };
}
function continueGame(d) {
  G.profile = d.profile; G.known = d.known; G.selected = d.selected ?? 1; G.quests = d.quests; G.inv = d.inv || {};
  G.points = d.points || 0; G.runes = d.runes || []; G.opened = d.opened || []; G.visitedHome = d.visitedHome;
  buildWorld();
  for (const k of G.opened) { const [x, y] = k.split(',').map(Number); setT(x, y, '.'); }
  for (const [x, y] of d.ice || []) setT(x, y, 'i');
  const byId = {};
  World.objects.forEach((o) => (byId[o.id] = o));
  for (const [id, lit] of d.lit || []) if (byId[id]) byId[id].lit = lit;
  for (const [id, x, y, key] of d.crates || []) if (byId[id]) Object.assign(byId[id], { x, y, rx: x, ry: y, key });
  World.objects = World.objects.filter((o) => !(o.type === 'rune' && G.runes.includes(o.rid)) && !(o.type === 'item' && G.inv[o.item]));
  G.player = makePlayer(d.pos.x, d.pos.y);
  G.player.mana = maxMana();
  if (d.lumen) G.player.lumen = true;
  enterPlay();
  toast(`Willkommen zurück, ${G.profile.name}!`);
}
function newGame(profile) {
  G.profile = profile;
  G.known = ['lumen', 'ignis']; G.selected = 1;
  G.quests = { feuer: 'none', perle: 'none', buch: 'none', kristall: 'none', fest: 'none' };
  G.inv = {}; G.points = 0; G.runes = []; G.opened = []; G.visitedHome = false;
  buildWorld();
  G.player = makePlayer(21.5, 20.6);
  G.player.mana = maxMana();
  enterPlay();
  setTimeout(() => talkTo(npcById('direktorin')), 1100);
}
function enterPlay() {
  G.state = 'play';
  G.room = null;
  showScreen(null);
  $('hud').classList.remove('hidden');
  buildSpellbar(); updateHUD();
  lastMana = -1;
  snapCam();
  G.fade = 1;
  G.focus = { x: G.player.x, y: G.player.y };
  const r0 = roomAt(G.player.x, G.player.y);
  if (r0) { G.amb = r0.amb; G.outdoor = r0.outdoor ? 1 : 0; }
}
function finishGame() {
  if (G.quests.fest === 'done') return;
  completeQuest('fest', 100);
  G.modal = true;
  const hs = house();
  const base = { gipfelsturm: 255, wiesengrund: 238, nebelsee: 262, duenenglut: 247 };
  const scores = HOUSE_ORDER.map((id) => ({ id, pts: id === hs.id ? 200 + G.points : base[id] })).sort((a, b) => b.pts - a.pts);
  $('end-standings').innerHTML = scores.map((s, i) => `<div class="stand ${s.id === hs.id ? 'me' : ''}" style="--c:${HOUSES[s.id].color}">
      <span class="pl">${i + 1}.</span>${crestSVG(s.id, 34)}<span class="hn">${HOUSES[s.id].name}</span><span class="hp">${s.pts}</span></div>`).join('');
  $('end-text').innerHTML = `Über der Akademie Silberfjord erstrahlt das Nordlicht in den Farben von <b style="color:${hs.light}">${hs.name}</b>.
    Dank dir, ${G.profile.name}, gewinnt dein Haus den Nordlicht-Pokal des ersten Schuljahres!`;
  $('end-runes').textContent = `Runensteine gefunden: ${G.runes.length} / 8`;
  showScreen('screen-end');
  save();
}

// ───────────────────────── Eingabe ─────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (G.state !== 'play' || G.modal || e.repeat) return;
  if (G.dialog) { if (k === 'e' || k === ' ' || k === 'enter') advanceDialog(); return; }
  if (k >= '1' && k <= '6') selectSpell(+k - 1);
  else if (k === ' ') { const p = G.player; cast(SPELLS[G.selected].id, p.fx, p.fy); }
  else if (k === 'e') interact();
  else if (k === 'q') togglePanel('quests');
  else if (k === 'h') togglePanel('help');
  else if (k === 'm') $('minimap').classList.toggle('hidden');
  else if (k === 'escape' && G.panel) togglePanel(G.panel);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('mousedown', (e) => {
  if (G.state !== 'play' || G.modal || e.button !== 0) return;
  if (G.dialog) { advanceDialog(); return; }
  const p = G.player;
  const rx = e.clientX - W / 2 + cam.x, ry = e.clientY - H / 2 + cam.y + 22;
  const a = rx / 32, b = ry / 16;
  const wx = (a + b) / 2, wy = (b - a) / 2;
  let dx = wx - p.x, dy = wy - p.y;
  const l = Math.hypot(dx, dy);
  if (l < 0.05) return;
  dx /= l; dy /= l;
  p.fx = dx; p.fy = dy;
  cast(SPELLS[G.selected].id, dx, dy);
});
$('dialog').addEventListener('click', advanceDialog);

// ───────────────────────── Menüs ─────────────────────────
const draft = { name: '', skin: SKINS[1], hair: HAIRS[1], wand: randomWand(), house: null };
const NAME_IDEAS = ['Astrid', 'Leif', 'Saga', 'Finn', 'Ylvi', 'Torben', 'Ronja', 'Mats', 'Ida', 'Juna', 'Eskil', 'Liva'];

function initMenus() {
  const saved = loadSave();
  if (saved && saved.profile) $('btn-continue').classList.remove('hidden');
  $('btn-continue').addEventListener('click', () => { const d = loadSave(); if (d) continueGame(d); });
  $('btn-new').addEventListener('click', () => {
    if (loadSave() && !confirm('Ein neues Schuljahr überschreibt deinen bisherigen Spielstand. Fortfahren?')) return;
    showScreen('screen-name');
    $('inp-name').placeholder = 'z. B. ' + pick(NAME_IDEAS);
    setTimeout(() => $('inp-name').focus(), 50);
  });
  // Name & Aussehen
  const sw = (el, list, prop) => {
    el.innerHTML = '';
    list.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (draft[prop] === c ? ' sel' : '');
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => { draft[prop] = c; sw(el, list, prop); });
      el.appendChild(b);
    });
  };
  sw($('sw-skin'), SKINS, 'skin');
  sw($('sw-hair'), HAIRS, 'hair');
  const goWand = () => {
    draft.name = ($('inp-name').value.trim() || $('inp-name').placeholder.replace('z. B. ', '')).slice(0, 18);
    showScreen('screen-wand');
    buildWandUI();
  };
  $('btn-name-next').addEventListener('click', goWand);
  $('inp-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') goWand(); });
  // Zauberstab
  $('btn-wand-random').addEventListener('click', () => {
    draft.wand = randomWand();
    buildWandUI();
    $('wand-preview').classList.remove('shine'); void $('wand-preview').offsetWidth; $('wand-preview').classList.add('shine');
  });
  $('inp-length').addEventListener('input', (e) => { draft.wand.length = +e.target.value; updateWandText(); });
  $('btn-wand-next').addEventListener('click', () => { showScreen('screen-house'); buildHouseUI(); });
  $('btn-wand-back').addEventListener('click', () => showScreen('screen-name'));
  $('btn-house-back').addEventListener('click', () => showScreen('screen-wand'));
  $('btn-house-go').addEventListener('click', () => {
    if (!draft.house) return;
    newGame({ name: draft.name, skin: draft.skin, hair: draft.hair, wand: { ...draft.wand }, house: draft.house });
  });
  // Ende
  $('btn-end-explore').addEventListener('click', () => { G.modal = false; showScreen(null); });
  $('btn-end-new').addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); location.reload(); });
}
function chips(el, list, key, labelFn) {
  el.innerHTML = '';
  list.forEach((item) => {
    const id = typeof item === 'string' ? item : item.id;
    const b = document.createElement('button');
    b.className = 'chip' + (draft.wand[key] === id ? ' sel' : '');
    b.innerHTML = labelFn(item);
    b.addEventListener('click', () => { draft.wand[key] = id; buildWandUI(); });
    el.appendChild(b);
  });
}
function buildWandUI() {
  chips($('ch-wood'), WOODS, 'wood', (w) => `<i class="dot" style="background:${w.color}"></i>${w.name}`);
  chips($('ch-core'), CORES, 'core', (c) => `<i class="dot glow" style="background:${c.color};color:${c.color}"></i>${c.name}`);
  chips($('ch-flex'), FLEX, 'flex', (f) => f);
  $('inp-length').value = draft.wand.length;
  updateWandText();
}
function updateWandText() {
  const w = draft.wand;
  $('lbl-length').textContent = String(w.length).replace('.', ',') + ' cm';
  $('wand-desc').innerHTML = `<div class="wd-main">${wandLong(w)}</div><div class="wd-bonus">✦ Besonderheit: ${coreOf(w).bonus}</div>`;
}
function buildHouseUI() {
  const el = $('house-cards');
  el.innerHTML = '';
  for (const id of HOUSE_ORDER) {
    const h = HOUSES[id];
    const c = document.createElement('button');
    c.className = 'hcard' + (draft.house === id ? ' sel' : '');
    c.style.setProperty('--c', h.color);
    c.style.setProperty('--cl', h.light);
    c.innerHTML = `<div class="hcrest">${crestSVG(id, 88)}</div><div class="hname">${h.name}</div>
      <div class="htraits">${h.traits.map((t) => `<span>${t}</span>`).join('')}</div>
      <div class="hmotto">${h.motto}</div><div class="hroom">${h.room}</div><div class="hbonus">${h.bonus}</div>`;
    c.addEventListener('click', () => {
      draft.house = id;
      buildHouseUI();
      $('btn-house-go').disabled = false;
      $('btn-house-go').textContent = `Ins Haus ${h.name} einschreiben`;
    });
    el.appendChild(c);
  }
}

// ───────────────────────── Hauptschleife ─────────────────────────
let last = performance.now();
let previewCv = null;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
    render(dt);
    if (!$('screen-wand').classList.contains('hidden')) drawWandPreview(previewCv, draft.wand, G.time);
    if (!$('screen-name').classList.contains('hidden')) drawNamePreview();
  } catch (err) {
    console.error(err);
    document.body.dataset.error = String(err && err.stack || err);
  }
  requestAnimationFrame(frame);
}
function drawNamePreview() {
  const cv = $('name-preview'), c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.save(); c.scale(2, 2);
  const a = G.time * 0.8;
  drawWizard(c, cv.width / 4, cv.height / 2 - 4 + 30, { robe: '#1d2433', trim: '#c0c8d4', hat: '#2a3242', skin: draft.skin, hair: draft.hair,
    fx: Math.cos(a), fy: Math.sin(a) * 0.3 + 0.6, time: G.time, wand: woodOf(draft.wand).color, tip: coreOf(draft.wand).color });
  c.restore();
}

window.addEventListener('resize', resize);
resize();
buildWorld();
previewCv = $('wand-preview');
initMenus();
requestAnimationFrame(frame);
