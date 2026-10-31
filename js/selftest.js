'use strict';
// Automatischer Durchlauf aller Aufgaben (nur mit ?test=1&nodlg=1&selftest=1)
(function () {
  const R = {};
  const p = G.player;
  const sim = (sec) => { for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); };
  const place = (x, y) => { p.x = x; p.y = y; p.lastTile = ''; sim(0.05); };
  const moveTo = (x, y) => {
    for (let i = 0; i < 900; i++) {
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d < 0.08) return true;
      const st = Math.min(d, 0.06);
      tryMove(p, (dx / d) * st, (dy / d) * st);
      update(1 / 60);
    }
    return false;
  };
  const castDir = (id, dx, dy) => { const l = Math.hypot(dx, dy); p.mana = maxMana(); cast(id, dx / l, dy / l); sim(1.2); };
  const talkAll = (id) => { talkTo(npcById(id)); let k = 0; while (G.dialog && k++ < 40) { G.dialog.shown = 1e9; advanceDialog(); } };
  try {
    talkAll('direktorin');
    R.feuerStarted = G.quests.feuer;
    place(18.5, 7.5); castDir('ignis', 0, -1);
    place(25.5, 7.5); castDir('ignis', 0, -1);
    place(18.5, 10.5); castDir('ignis', 0, 1);
    place(25.5, 10.5); castDir('ignis', 0, 1);
    R.lit = litCount();
    place(22.5, 18.6); talkAll('direktorin');
    R.feuer = G.quests.feuer;
    // Haustüren
    place(16.5, 5.5); R.ownDoor = moveTo(13.5, 5.5);
    place(16.5, 12.5); moveTo(13.5, 12.5); R.foreignDoorBlocked = p.x > 15.5;
    // Frostvik & Perle
    place(34.5, 19.5); talkAll('frostvik');
    R.glacies = G.known.includes('glacies');
    place(38.5, 39.4);
    for (let i = 0; i < 8 && !G.inv.perle; i++) {
      castDir('glacies', 42.5 - p.x, 42.5 - p.y);
      moveTo(42.5, 42.5);
    }
    R.perle = !!G.inv.perle;
    place(34.5, 19.5); talkAll('frostvik'); R.perleQuest = G.quests.perle;
    // Tintenfjell & Buch
    place(11.5, 21.6); talkAll('tintenfjell');
    place(9.5, 18.5); castDir('reserare', -1, 0);
    R.doorOpen = T(8, 18) === '.';
    moveTo(7.5, 18.5); moveTo(4.5, 17.5);
    R.buch = !!G.inv.buch;
    place(11.5, 21.6); talkAll('tintenfjell'); R.buchQuest = G.quests.buch;
    // Grimnir, Kiste, Krypta
    place(32.5, 10.5); talkAll('grimnir');
    place(34.5, 5.5); castDir('ventus', 1, 0);
    const crate = World.objects.find((o) => o.id === 'crate_36_5');
    R.crate = [crate.x, crate.y];
    moveTo(36.5, 5.5); moveTo(38.5, 5.5); moveTo(39.5, 4.5);
    R.inCrypt = G.room && G.room.name;
    castDir('lumen', 1, 0);
    moveTo(4.5, 39.5); moveTo(8.5, 39.5); moveTo(10.5, 39.5); moveTo(10.5, 30.5); moveTo(12.5, 30.5); moveTo(12.5, 39.5); moveTo(13.5, 39.5);
    R.kristall = !!G.inv.kristall;
    place(13.5, 29.4); // Rune
    place(4.5, 30.5); moveTo(3.5, 29.5);
    R.backInLager = G.room && G.room.name;
    place(32.5, 10.5); talkAll('grimnir'); R.kristallQuest = G.quests.kristall;
    // Fest
    place(22.5, 18.6); talkAll('direktorin');
    R.aurora = G.known.includes('aurora'); R.fest = G.quests.fest;
    place(21.5, 11.5);
    p.mana = maxMana(); cast('aurora', 0, -1);
    R.runes = G.runes.length; R.points = G.points;
    ['olav', 'schueler0', 'prefect_gipfelsturm'].forEach(talkAll);
    save(); R.saved = !!localStorage.getItem(SAVE_KEY);
  } catch (e) { R.error = String(e.stack || e); }
  setTimeout(() => {
    R.endShown = !document.getElementById('screen-end').classList.contains('hidden');
    R.festFinal = G.quests.fest; R.finalPoints = G.points;
    document.body.dataset.test = JSON.stringify(R);
  }, 3600);
})();
