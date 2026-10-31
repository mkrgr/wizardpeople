'use strict';
// ───────────────────────── Grundkonstanten & Helfer ─────────────────────────
const TW = 64, TH = 32, MW = 50, MH = 50;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function hexRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(h, a) {
  const [r, g, b] = hexRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(h, f) {
  const [r, g, b] = hexRgb(h);
  const m = (v) => Math.round(clamp(f < 0 ? v * (1 + f) : v + (255 - v) * f, 0, 255));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
}

// ───────────────────────── Häuser ─────────────────────────
const HOUSES = {
  gipfelsturm: {
    id: 'gipfelsturm', name: 'Gipfelsturm', color: '#3b7dd8', light: '#9cc8ff', dark: '#18345f',
    traits: ['Mut', 'Ausdauer', 'Gipfelstürmer-Geist'],
    motto: '„Kein Gipfel ist zu hoch.“',
    bonus: 'Bergbeine: +20 % Laufgeschwindigkeit',
    room: 'Ein Turmzimmer hoch über dem Fjord, in dem der Wind um die Zinnen heult.',
  },
  wiesengrund: {
    id: 'wiesengrund', name: 'Wiesengrund', color: '#3fa45b', light: '#a6e8b2', dark: '#1a4a28',
    traits: ['Treue', 'Gemütlichkeit', 'Gastfreundschaft'],
    motto: '„Wo wir sind, ist Zuhause.“',
    bonus: 'Innere Wärme: +50 % Mana-Regeneration',
    room: 'Eine warme Stube mit Kaminfeuer, Wolldecken und dem Duft von Zimtschnecken.',
  },
  nebelsee: {
    id: 'nebelsee', name: 'Nebelsee', color: '#8a96a3', light: '#dde4ea', dark: '#3c444d',
    traits: ['Weisheit', 'Ruhe', 'Tiefgang'],
    motto: '„Stille Wasser sind tief.“',
    bonus: 'Bedachtes Zaubern: −25 % Manakosten',
    room: 'Ein stiller Saal am Wasser, in dem der Nebel an den Fenstern Geschichten erzählt.',
  },
  duenenglut: {
    id: 'duenenglut', name: 'Dünenglut', color: '#d0413a', light: '#ffa595', dark: '#5e1714',
    traits: ['Ehrgeiz', 'Härte', 'Überlebenskunst'],
    motto: '„Wer brennt, der besteht.“',
    bonus: 'Feuriger Wille: Zauber fliegen 30 % weiter',
    room: 'Ein glutroter Raum voller Trophäen, in dem das Feuer niemals ausgeht.',
  },
};
const HOUSE_ORDER = ['gipfelsturm', 'wiesengrund', 'nebelsee', 'duenenglut'];

// ───────────────────────── Zauberstäbe ─────────────────────────
const WOODS = [
  { id: 'birke', name: 'Birke', color: '#e9dfc8', dark: '#9b8a6a', trait: 'Neuanfänge und klare Gedanken' },
  { id: 'eberesche', name: 'Eberesche', color: '#b0643a', dark: '#5e2f17', trait: 'Schutz vor dunkler Magie' },
  { id: 'wacholder', name: 'Wacholder', color: '#8a5a44', dark: '#43271b', trait: 'unbeugsame Beharrlichkeit' },
  { id: 'treibholz', name: 'Treibholz', color: '#c4c0b4', dark: '#6f6b62', trait: 'Anpassungsfähigkeit – vom Meer geformt' },
  { id: 'kiefer', name: 'Kiefer', color: '#cfa465', dark: '#7a5528', trait: 'Ausdauer in langen Polarnächten' },
  { id: 'mooreiche', name: 'Mooreiche', color: '#4a3c32', dark: '#1d1611', trait: 'uraltes, verborgenes Wissen' },
];
const CORES = [
  { id: 'nordlicht', name: 'Nordlichtfaser', color: '#7dffc4', bonus: 'Lumen leuchtet 40 % weiter' },
  { id: 'gletscher', name: 'Gletscherkristall', color: '#9fe8ff', bonus: 'Glacies friert einen breiteren Pfad' },
  { id: 'seeadler', name: 'Seeadlerfeder', color: '#f5e7c0', bonus: 'Ventus trägt doppelt so weit' },
  { id: 'glutstein', name: 'Glutsteinsplitter', color: '#ff9548', bonus: 'Ignis kostet 40 % weniger Mana' },
  { id: 'eisbaer', name: 'Eisbärhaar', color: '#ffffff', bonus: '+25 maximales Mana' },
];
const FLEX = ['biegsam', 'federnd', 'geschmeidig', 'starr', 'unnachgiebig'];
const SKINS = ['#f6d7bd', '#e9b990', '#c68a5e', '#8d5a3b', '#5c3a26'];
const HAIRS = ['#2b1d14', '#6b4226', '#c98e4a', '#eadba8', '#b9b9c6', '#a33a2a', '#1a1a2e'];

function woodOf(w) { return WOODS.find((x) => x.id === w.wood) || WOODS[0]; }
function coreOf(w) { return CORES.find((x) => x.id === w.core) || CORES[0]; }
function wandText(w) {
  return `${String(w.length).replace('.', ',')} cm, ${woodOf(w).name} mit einem Kern aus ${coreOf(w).name}, ${w.flex}`;
}
function wandLong(w) { return `${wandText(w)}. Ein Stab für ${woodOf(w).trait}.`; }
function randomWand() {
  return {
    wood: pick(WOODS).id,
    core: pick(CORES).id,
    flex: pick(FLEX),
    length: Math.round(rand(22, 34) * 2) / 2,
  };
}

// ───────────────────────── Zaubersprüche ─────────────────────────
const SPELLS = [
  { id: 'lumen', name: 'Lumen', cost: 15, color: '#e6f3ff', desc: 'Ein schwebendes Licht begleitet dich – unverzichtbar in dunklen Gewölben. Erneut wirken löscht es.' },
  { id: 'ignis', name: 'Ignis', cost: 12, color: '#ff8a3d', desc: 'Ein Flammenfunke entzündet Fackeln und Feuerschalen und schmilzt Eis.' },
  { id: 'glacies', name: 'Glacies', cost: 18, color: '#8fe3ff', desc: 'Ein eisiger Strahl lässt Wasser zu begehbarem Eis gefrieren und löscht Feuer.' },
  { id: 'ventus', name: 'Ventus', cost: 14, color: '#d4f5e2', desc: 'Eine kräftige Windböe schiebt schwere Kisten fort.' },
  { id: 'reserare', name: 'Reserare', cost: 20, color: '#ffd86b', desc: 'Öffnet verschlossene Türen und Schlösser.' },
  { id: 'aurora', name: 'Aurora', cost: 40, color: '#b38cff', desc: 'Der älteste Zauber der Akademie: Ein Nordlicht in deinen Hausfarben erstrahlt.' },
];
const SPELL = {};
SPELLS.forEach((s) => (SPELL[s.id] = s));

// ───────────────────────── SVG-Grafiken ─────────────────────────
let _svgId = 0;
function crestSVG(id, size = 72) {
  const h = HOUSES[id];
  const L = h.light, D = h.dark, C = h.color;
  const uid = 'cs' + _svgId++;
  const shield = 'M14 8 H86 V44 C86 70 66 86 50 94 C34 86 14 70 14 44 Z';
  let e = '';
  switch (id) {
    case 'gipfelsturm':
      e = `<path d="M22 74 L42 36 L50 48 L60 26 L80 74 Z" fill="${L}"/>
        <path d="M42 36 L36.5 47 L42 44 L46.5 46.5 Z M60 26 L54 39 L60 36.5 L65.5 39.5 Z" fill="#fff"/>
        <circle cx="30" cy="28" r="2.6" fill="#fff" opacity=".85"/><circle cx="72" cy="20" r="1.8" fill="#fff" opacity=".7"/>`;
      break;
    case 'wiesengrund':
      e = `<path d="M50 78 V34" stroke="${L}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M50 56 C38 55 31 47 30 37 C41 38 49 45 50 56 Z" fill="${L}"/>
        <path d="M50 46 C61 45 68 37 70 27 C59 28 51 35 50 46 Z" fill="${L}"/>
        <path d="M50 68 C61 68 68 61 71 53 C60 53 52 59 50 68 Z" fill="${L}" opacity=".85"/>
        <path d="M24 80 Q50 70 76 80" stroke="${L}" stroke-width="3" fill="none"/>`;
      break;
    case 'nebelsee':
      e = `<circle cx="62" cy="32" r="9" fill="${L}"/><circle cx="66" cy="29" r="8" fill="${D}"/>
        <g fill="none" stroke="${L}" stroke-width="3.2" stroke-linecap="round">
        <path d="M26 52 Q32 47 38 52 T50 52 T62 52 T74 52"/>
        <path d="M30 62 Q36 57 42 62 T54 62 T66 62 T72 62" opacity=".75"/>
        <path d="M36 72 Q42 67 48 72 T60 72 T66 72" opacity=".5"/></g>`;
      break;
    case 'duenenglut': {
      const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return `<line x1="${50 + Math.cos(r) * 16}" y1="${40 + Math.sin(r) * 16}" x2="${50 + Math.cos(r) * 22}" y2="${40 + Math.sin(r) * 22}"/>`;
      }).join('');
      e = `<circle cx="50" cy="40" r="11" fill="${L}"/><g stroke="${L}" stroke-width="3" stroke-linecap="round">${rays}</g>
        <path d="M10 78 Q36 56 56 68 Q72 76 90 60 L90 100 L10 100 Z" fill="${C}" stroke="${L}" stroke-width="2.5"/>`;
      break;
    }
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <defs><clipPath id="${uid}"><path d="${shield}"/></clipPath></defs>
    <path d="${shield}" fill="${D}"/>
    <g clip-path="url(#${uid})"><rect x="0" y="0" width="100" height="16" fill="${C}" opacity=".75"/>${e}</g>
    <path d="${shield}" fill="none" stroke="${L}" stroke-width="3"/></svg>`;
}

function spellIconSVG(id, color) {
  const c = color;
  let inner = '';
  switch (id) {
    case 'lumen': {
      const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return `<line x1="${16 + Math.cos(r) * 8.5}" y1="${16 + Math.sin(r) * 8.5}" x2="${16 + Math.cos(r) * 13}" y2="${16 + Math.sin(r) * 13}"/>`;
      }).join('');
      inner = `<circle cx="16" cy="16" r="5.5" fill="${c}"/><g stroke="${c}" stroke-width="2" stroke-linecap="round">${rays}</g>`;
      break;
    }
    case 'ignis':
      inner = `<path d="M16 3 C19 9 25 12 24 20 C23 26 19 29 16 29 C11 29 8 25 8 20 C8 15 12 13 12 8 C14 10 15 12 15 14 C17 11 17 7 16 3Z" fill="${c}"/>
        <path d="M16 15 C18 18 20 20 19.5 23 C19 26 17.5 27 16 27 C14 27 12.5 25.5 12.5 23 C12.5 20.5 15 19 16 15Z" fill="#ffe2a0"/>`;
      break;
    case 'glacies':
      inner = `<g stroke="${c}" stroke-width="2.2" stroke-linecap="round" fill="none">
        <line x1="16" y1="3" x2="16" y2="29"/><line x1="4.7" y1="9.5" x2="27.3" y2="22.5"/><line x1="4.7" y1="22.5" x2="27.3" y2="9.5"/>
        <path d="M12.5 5.5 L16 9 L19.5 5.5 M12.5 26.5 L16 23 L19.5 26.5 M5 14 L9.5 13 L8 8.8 M27 18 L22.5 19 L24 23.2 M5 18 L9.5 19 L8 23.2 M27 14 L22.5 13 L24 8.8"/></g>`;
      break;
    case 'ventus':
      inner = `<g stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none">
        <path d="M3 12 H19 A4 4 0 1 0 15 8"/><path d="M3 18 H24 A4 4 0 1 1 20 22"/><path d="M3 24 H12"/></g>`;
      break;
    case 'reserare':
      inner = `<g stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none">
        <circle cx="10" cy="16" r="5.5"/><path d="M15.5 16 H28 M24 16 V21 M28 16 V20"/></g><circle cx="10" cy="16" r="1.8" fill="${c}"/>`;
      break;
    case 'aurora':
      inner = `<g stroke-width="2.6" stroke-linecap="round" fill="none">
        <path d="M3 21 Q9 9 16 17 T29 11" stroke="#6fffc0"/><path d="M3 26 Q10 16 16 22 T29 17" stroke="#6fd6ff" opacity=".85"/>
        <path d="M3 15 Q9 4 16 11 T29 5" stroke="${c}" opacity=".85"/></g>`;
      break;
  }
  return `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">${inner}</svg>`;
}
