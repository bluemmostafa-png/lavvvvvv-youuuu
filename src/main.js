import './style.css';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HEART_PATH = 'M12 21s-7.5-4.6-10-9.3C.3 8.3 2.3 4 6.3 4c2.3 0 3.9 1.3 5.7 3.3C13.8 5.3 15.4 4 17.7 4c4 0 6 4.3 4.3 7.7C19.5 16.4 12 21 12 21z';
const HEART_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
const FLAKE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3.6 10.3L7 9.3 6 5.9M20.4 13.7L17 14.7l1 3.4M3.6 13.7L7 14.7l-1 3.4M20.4 10.3L17 9.3l1-3.4"/></svg>`;

/* ---------- audio + haptics ---------- */
let actx = null;
let muted = false;
function tone(freq, dur = 0.15, type = 'sine', vol = 0.08, delay = 0) {
  if (muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {
    /* audio unavailable */
  }
}
const NOTES = [523, 587, 659, 698, 784, 880, 988, 1046, 1175];
const sfx = {
  tap: () => tone(700, 0.07, 'triangle', 0.05),
  good: () => { tone(784, 0.12); tone(1046, 0.2, 'sine', 0.08, 0.08); },
  bad: () => tone(170, 0.22, 'triangle', 0.07),
  chime: (i) => { tone(NOTES[i % 9], 0.45, 'sine', 0.09); tone(NOTES[i % 9] * 2, 0.3, 'sine', 0.03); },
  tick: () => tone(1500, 0.04, 'square', 0.03),
  bell: () => [0, 0.55, 1.1].forEach((d) => tone(196, 0.8, 'sine', 0.12, d)),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'sine', 0.08, i * 0.11)),
  boom: () => { tone(90, 0.4, 'triangle', 0.1); tone(rand(900, 1400), 0.25, 'sine', 0.03, 0.05); },
};
const buzz = (p) => navigator.vibrate?.(p);

/* ---------- canvases ---------- */
const bg = $('#bg');
const bctx = bg.getContext('2d');
const fxc = $('#fx');
const fctx = fxc.getContext('2d');
let W = 0;
let H = 0;
let stars = [];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  for (const [c, x] of [[bg, bctx], [fxc, fctx]]) {
    c.width = W * dpr;
    c.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  stars = Array.from({ length: Math.round((W * H) / 4200) }, () => ({
    x: Math.random() * W, y: Math.random() * H * 0.9, r: rand(0.3, 1.5), p: rand(0, 6.28), s: rand(0.6, 2),
  }));
}
addEventListener('resize', resize);
resize();

const MODES = {
  intro: { lantern: 10, flake: 12, petal: 8 },
  ocean: { lantern: 3, flake: 8, petal: 4 },
  tower: { lantern: 18, flake: 3, petal: 5 },
  ice: { lantern: 2, flake: 46, petal: 0 },
  ball: { lantern: 5, flake: 10, petal: 16 },
  box: { lantern: 8, flake: 10, petal: 12 },
  party: { lantern: 16, flake: 6, petal: 24 },
};
let mode = MODES.intro;
let modeName = 'intro';
const ents = { lantern: [], flake: [], petal: [] };

function setTheme(name) {
  modeName = name;
  mode = MODES[name];
  document.body.dataset.theme = name;
}

function spawn(kind) {
  const base = { x: rand(0, W), a: 0, ph: rand(0, 6.28) };
  if (kind === 'lantern') return { ...base, y: rand(H * 0.25, H * 1.05), s: rand(7, 16), vy: rand(0.15, 0.45) };
  if (kind === 'flake') return { ...base, y: rand(-20, H * 0.9), s: rand(3, 9), vy: rand(0.3, 1.1), rot: rand(0, 6.28), vr: rand(-0.01, 0.01) };
  return { ...base, y: rand(-20, H * 0.9), s: rand(5, 10), vy: rand(0.4, 1), rot: rand(0, 6.28), vr: rand(-0.03, 0.03), heart: modeName === 'party' && Math.random() < 0.5 };
}

function drawLantern(c, l, t) {
  const flick = 0.85 + Math.sin(t * 6 + l.ph) * 0.15;
  const r = l.s * 2.6;
  const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
  g.addColorStop(0, `rgba(255,190,90,${0.45 * l.a * flick})`);
  g.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = g;
  c.fillRect(l.x - r, l.y - r, r * 2, r * 2);
  c.fillStyle = `rgba(255,${170 + 40 * flick | 0},90,${0.9 * l.a})`;
  c.beginPath();
  c.roundRect(l.x - l.s * 0.45, l.y - l.s * 0.6, l.s * 0.9, l.s * 1.2, l.s * 0.25);
  c.fill();
}
function drawFlake(c, f) {
  c.save();
  c.translate(f.x, f.y);
  c.rotate(f.rot);
  c.strokeStyle = `rgba(220,240,255,${0.75 * f.a})`;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    c.moveTo(0, 0);
    c.lineTo(0, f.s);
    c.moveTo(0, f.s * 0.55);
    c.lineTo(f.s * 0.25, f.s * 0.75);
    c.moveTo(0, f.s * 0.55);
    c.lineTo(-f.s * 0.25, f.s * 0.75);
  }
  c.stroke();
  c.restore();
}
function heartShape(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  c.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  c.fill();
}
function drawPetal(c, p) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.rot);
  c.fillStyle = p.heart ? `rgba(224,30,55,${0.8 * p.a})` : `rgba(170,18,30,${0.85 * p.a})`;
  if (p.heart) heartShape(c, 0, -p.s / 2, p.s * 1.4);
  else {
    c.beginPath();
    c.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `rgba(255,120,130,${0.35 * p.a})`;
    c.beginPath();
    c.ellipse(-p.s * 0.3, -p.s * 0.1, p.s * 0.45, p.s * 0.2, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/* fx particles */
const parts = [];
const COLORS = ['#d4af37', '#f5dc8f', '#ff4d6d', '#e01e37', '#ffffff', '#ff8fa3'];
function emit(x, y, { n = 24, colors = COLORS, speed = 4, g = 0.08, life = 60, size = 3, shape = 'dot' } = {}) {
  const count = reduceMotion ? Math.ceil(n / 3) : n;
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(speed * 0.3, speed);
    const l = life * rand(0.6, 1.2);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, life: l, max: l, color: pick(colors), size: size * rand(0.6, 1.4), shape, rot: rand(0, 6), vr: rand(-0.2, 0.2) });
  }
}
function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
const sparkleEl = (el, colors) => emit(...centerOf(el), { n: 22, speed: 3.5, colors: colors ?? ['#d4af37', '#f5dc8f', '#ffffff'] });
const shatterEl = (el) => emit(...centerOf(el), { n: 18, speed: 4, colors: ['#ffffff', '#bfe6ff', '#8fd3ff'], shape: 'shard', g: 0.12 });
function firework(x, y) {
  const colors = shuffle(COLORS).slice(0, 3);
  emit(x, y, { n: 70, speed: 5.5, g: 0.05, life: 80, size: 2.4, colors });
  emit(x, y, { n: 10, speed: 2, g: 0.02, life: 50, size: 4, colors: ['#ff4d6d', '#e01e37'], shape: 'heart' });
}
function confetti(n = 140) {
  const count = reduceMotion ? 30 : n;
  for (let i = 0; i < count; i++) {
    const l = rand(150, 260);
    parts.push({ x: rand(0, W), y: rand(-H * 0.4, -10), vx: rand(-1.5, 1.5), vy: rand(1.5, 4), g: 0.03, life: l, max: l, color: pick(COLORS), size: rand(5, 9), shape: 'conf', rot: rand(0, 6), vr: rand(-0.2, 0.2) });
  }
}

let lastT = performance.now();
function loop(now) {
  const t = now / 1000;
  const dtf = Math.min(3, (now - lastT) / 16.67);
  lastT = now;

  bctx.clearRect(0, 0, W, H);
  const moon = bctx.createRadialGradient(W * 0.18, H * 0.1, 0, W * 0.18, H * 0.1, Math.min(W, H) * 0.35);
  moon.addColorStop(0, 'rgba(245,220,143,.18)');
  moon.addColorStop(1, 'rgba(245,220,143,0)');
  bctx.fillStyle = moon;
  bctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const a = 0.35 + Math.sin(t * s.s + s.p) * 0.35;
    bctx.fillStyle = `rgba(255,240,220,${a})`;
    bctx.beginPath();
    bctx.arc(s.x, s.y, s.r, 0, 6.283);
    bctx.fill();
  }

  for (const kind of ['lantern', 'flake', 'petal']) {
    const list = ents[kind];
    const want = Math.round(mode[kind] * (reduceMotion ? 0.3 : 1));
    if (list.length < want && Math.random() < 0.08 * dtf) list.push(spawn(kind));
    let alive = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      alive++;
      if (alive > want) e.dead = true;
      e.a = e.dead ? e.a - 0.02 * dtf : Math.min(1, e.a + 0.01 * dtf);
      if (kind === 'lantern') {
        e.y -= e.vy * dtf;
        e.x += Math.sin(t * 0.8 + e.ph) * 0.2 * dtf;
      } else {
        e.y += e.vy * dtf;
        e.x += Math.sin(t + e.ph) * (kind === 'petal' ? 0.8 : 0.35) * dtf;
        e.rot += e.vr * dtf;
      }
      if (e.a <= 0 && e.dead) { list.splice(i, 1); continue; }
      if (e.y < -40 || e.y > H + 30) { list.splice(i, 1); continue; }
      if (kind === 'lantern') drawLantern(bctx, e, t);
      else if (kind === 'flake') drawFlake(bctx, e);
      else drawPetal(bctx, e);
    }
  }

  fctx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += p.g * dtf;
    p.vx *= 0.99;
    p.x += p.vx * dtf;
    p.y += p.vy * dtf;
    p.rot += p.vr * dtf;
    p.life -= dtf;
    if (p.life <= 0 || p.y > H + 20) { parts.splice(i, 1); continue; }
    const a = Math.min(1, p.life / (p.max * 0.4));
    fctx.globalAlpha = a;
    fctx.fillStyle = p.color;
    if (p.shape === 'conf' || p.shape === 'shard') {
      fctx.save();
      fctx.translate(p.x, p.y);
      fctx.rotate(p.rot);
      if (p.shape === 'conf') fctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        fctx.beginPath();
        fctx.moveTo(0, -p.size);
        fctx.lineTo(p.size * 0.5, p.size);
        fctx.lineTo(-p.size * 0.5, p.size);
        fctx.fill();
      }
      fctx.restore();
    } else if (p.shape === 'heart') heartShape(fctx, p.x, p.y, p.size * 2.5);
    else {
      fctx.beginPath();
      fctx.arc(p.x, p.y, p.size, 0, 6.283);
      fctx.fill();
    }
  }
  fctx.globalAlpha = 1;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- floaters (rising tappable items) ---------- */
function floaters(area, { every, make, speed }) {
  const list = new Map();
  let raf = 0;
  let last = performance.now();
  let acc = every * 0.8;
  let running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    acc += dt * 1000;
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (acc >= every) {
      acc = 0;
      const el = make();
      if (el) {
        area.appendChild(el);
        const size = el.offsetWidth || 64;
        list.set(el, { x: rand(6, Math.max(8, w - size - 6)), y: h + 8, v: rand(...speed), ph: rand(0, 6.28), amp: rand(6, 16), size, t: 0 });
      }
    }
    for (const [el, it] of list) {
      it.t += dt;
      it.y -= it.v * dt;
      const x = Math.min(w - it.size, Math.max(0, it.x + Math.sin(it.t * 1.6 + it.ph) * it.amp));
      el.style.transform = `translate(${x}px,${it.y}px)`;
      if (it.y < -it.size - 20) {
        el.remove();
        list.delete(el);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    pop: (el) => list.delete(el),
    stop: () => { running = false; cancelAnimationFrame(raf); },
  };
}

/* ---------- stage 1: Moana memory ---------- */
function playOcean(root, done) {
  const items = ['🦐', '🦑', '🦀', '🦞', '🐟', '🐚'];
  const deck = shuffle([...items, ...items]);
  root.innerHTML = `
    <div class="chips"><span class="chip">المحاولات: <b id="moves">0</b></span><span class="chip">الوليمة: <b id="pairs">0</b> / 6</span></div>
    <div class="mem-grid">${deck.map((e) => `<button class="card" type="button" data-e="${e}" aria-label="كارت مقفول"><span class="inner"><span class="face back"><i>&#10086;</i></span><span class="face front">${e}</span></span></button>`).join('')}</div>
    <div class="feast panel" aria-live="polite"><span class="plate-label">سفرة السي فود:</span></div>`;
  const cards = $$('.card', root);
  const feast = $('.feast', root);
  let first = null;
  let lock = true;
  let moves = 0;
  let pairs = 0;
  const timers = [];

  cards.forEach((c, i) => timers.push(setTimeout(() => c.classList.add('flip'), 150 + i * 40)));
  timers.push(setTimeout(() => {
    cards.forEach((c) => c.classList.remove('flip'));
    lock = false;
  }, 1900));

  cards.forEach((c) => c.addEventListener('click', () => {
    if (lock || c.classList.contains('flip')) return;
    sfx.tap();
    buzz(10);
    c.classList.add('flip');
    c.setAttribute('aria-label', c.dataset.e);
    if (!first) { first = c; return; }
    moves++;
    $('#moves', root).textContent = moves;
    if (first.dataset.e === c.dataset.e) {
      first.classList.add('matched');
      c.classList.add('matched');
      pairs++;
      $('#pairs', root).textContent = pairs;
      sfx.good();
      sparkleEl(c);
      sparkleEl(first);
      feast.insertAdjacentHTML('beforeend', `<span class="dish">${c.dataset.e}</span>`);
      first = null;
      if (pairs === items.length) timers.push(setTimeout(done, 700));
    } else {
      lock = true;
      const a = first;
      first = null;
      timers.push(setTimeout(() => {
        a.classList.remove('flip');
        c.classList.remove('flip');
        a.setAttribute('aria-label', 'كارت مقفول');
        c.setAttribute('aria-label', 'كارت مقفول');
        lock = false;
      }, 750));
    }
  }));
  return () => timers.forEach(clearTimeout);
}

/* ---------- stage 2: Rapunzel kitchen ---------- */
function playTower(root, done) {
  const recipes = [
    { name: 'الحواوشي', icon: '🥙', items: [['🥩', 'لحمة مفرومة'], ['🍞', 'عيش بلدي'], ['🧅', 'بصل'], ['🌶️', 'فلفل']] },
    { name: 'محشي ورق العنب', icon: '🍃', items: [['🍃', 'ورق عنب'], ['🍚', 'رز'], ['🍅', 'طماطم'], ['🍋', 'ليمون']] },
  ];
  const junk = [['🍫', 'شوكولاتة'], ['🍩', 'دونات'], ['🧁', 'كب كيك'], ['🍬', 'بونبوني'], ['🍦', 'آيس كريم'], ['🍪', 'كوكيز']];
  let r = 0;
  let got = new Set();
  let finished = false;
  const timers = [];
  root.innerHTML = `
    <div class="recipe panel"><div class="recipe-title" id="rt"></div><ul class="recipe-list" id="rl"></ul></div>
    <div class="sky" id="sky"><div class="tower-sil" aria-hidden="true"></div><p class="toast" id="toast" role="status"></p></div>`;
  const sky = $('#sky', root);
  const toast = $('#toast', root);
  let toastT = 0;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 1300);
  };
  const render = () => {
    const rc = recipes[r];
    $('#rt', root).innerHTML = `${rc.icon} وصفة ${rc.name} <small>(${r + 1} / 2)</small>`;
    $('#rl', root).innerHTML = rc.items.map(([e, n]) => `<li class="${got.has(e) ? 'got' : ''}"><span>${e}</span>${n}</li>`).join('');
  };
  render();

  function hit(el, [e, n]) {
    if (finished) return;
    fl.pop(el);
    const rc = recipes[r];
    const inRecipe = rc.items.some(([x]) => x === e);
    const ok = inRecipe && !got.has(e);
    el.classList.add(ok ? 'good' : 'bad');
    timers.push(setTimeout(() => el.remove(), 500));
    if (!ok) {
      sfx.bad();
      buzz(60);
      say(inRecipe ? `${n} خدناه خلاص` : `${n} مش من الوصفة يا قمر`);
      return;
    }
    got.add(e);
    sfx.good();
    buzz(15);
    sparkleEl(el, ['#ffb85c', '#f5dc8f', '#ffffff']);
    render();
    say(`${n} في الحلة`);
    if (got.size < rc.items.length) return;
    if (r === 0) {
      say('الحواوشي استوى! يلا على المحشي');
      r = 1;
      got = new Set();
      timers.push(setTimeout(render, 900));
    } else {
      finished = true;
      fl.stop();
      say('أحلى سفرة لأحلى أميرة');
      timers.push(setTimeout(done, 1000));
    }
  }

  const fl = floaters(sky, {
    every: 850,
    speed: [55, 85],
    make() {
      const need = recipes[r].items.filter(([e]) => !got.has(e));
      if (!need.length) return null;
      const item = Math.random() < 0.58 ? pick(need) : pick(junk);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'floater lantern-item';
      el.setAttribute('aria-label', item[1]);
      el.innerHTML = `<span class="bubble"><span class="emo">${item[0]}</span><span class="lbl">${item[1]}</span></span>`;
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); hit(el, item); }, { once: true });
      return el;
    },
  });
  return () => { fl.stop(); timers.forEach(clearTimeout); clearTimeout(toastT); };
}

/* ---------- stage 3: Elsa crystal memory ---------- */
function playIce(root, done) {
  root.innerHTML = `
    <div class="ice-hearts" aria-label="القلوب الجليدية">${[0, 1, 2].map(() => `<span class="ice-heart">${HEART_SVG}</span>`).join('')}</div>
    <p class="status" id="st" role="status">جهزي نفسك...</p>
    <div class="crystals">${Array.from({ length: 9 }, (_, i) => `<button class="crystal" type="button" data-i="${i}" aria-label="بلورة ${i + 1}" disabled>${FLAKE_SVG}</button>`).join('')}</div>`;
  const btns = $$('.crystal', root);
  const st = $('#st', root);
  const seq = [];
  let pos = 0;
  let round = 0;
  let accepting = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function glow(i) {
    const b = btns[i];
    b.classList.remove('lit');
    void b.offsetWidth;
    b.classList.add('lit');
    sfx.chime(i);
    later(() => b.classList.remove('lit'), 420);
  }
  function playSeq() {
    accepting = false;
    btns.forEach((b) => { b.disabled = true; });
    st.textContent = 'ركزي في سحر إيلسا...';
    const gap = Math.max(480, 650 - round * 60);
    seq.forEach((i, k) => later(() => glow(i), 700 + k * gap));
    later(() => {
      accepting = true;
      pos = 0;
      btns.forEach((b) => { b.disabled = false; });
      st.textContent = 'دورك! كرري نفس الترتيب';
    }, 700 + seq.length * gap);
  }
  function nextRound() {
    while (seq.length < 3 + round) {
      let n;
      do n = Math.floor(Math.random() * 9); while (n === seq[seq.length - 1]);
      seq.push(n);
    }
    playSeq();
  }
  btns.forEach((b) => b.addEventListener('click', () => {
    if (!accepting) return;
    const i = Number(b.dataset.i);
    glow(i);
    if (i !== seq[pos]) {
      accepting = false;
      sfx.bad();
      buzz([40, 30, 40]);
      shatterEl(b);
      b.classList.add('crack');
      later(() => b.classList.remove('crack'), 600);
      st.textContent = 'البلورة اتكسرت! هنعيد السحر تاني';
      later(playSeq, 1300);
      return;
    }
    shatterEl(b);
    buzz(12);
    pos++;
    if (pos < seq.length) return;
    accepting = false;
    const heart = $$('.ice-heart', root)[round];
    heart.classList.add('on');
    sparkleEl(heart, ['#ffffff', '#bfe6ff', '#8fd3ff', '#f5dc8f']);
    later(sfx.good, 250);
    round++;
    if (round === 3) {
      st.textContent = 'القلوب الجليدية نورت!';
      later(done, 1000);
    } else {
      st.textContent = 'قلب جليدي جديد نوّر!';
      later(nextRound, 1200);
    }
  }));
  later(nextRound, 600);
  return () => timers.forEach(clearTimeout);
}

/* ---------- stage 4: Cinderella hidden objects ---------- */
function playBall(root, done) {
  const LIMIT = 50;
  const decoys = ['🕯️', '🎀', '🌹', '👑', '🪞', '🎻', '💎', '🍷', '🎭', '🦋', '🕊️', '🌙', '✨', '💫', '🎃', '🐭', '🔔', '🌸', '🪄', '💍', '🧚', '🍾'];
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<line class="tick" x1="${20 + Math.sin(a) * 15}" y1="${20 - Math.cos(a) * 15}" x2="${20 + Math.sin(a) * 17}" y2="${20 - Math.cos(a) * 17}"/>`;
  }).join('');
  root.innerHTML = `
    <div class="ball-bar panel">
      <div class="clock" id="clock" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="face-c" cx="20" cy="20" r="18"/>${ticks}<line class="hand hand-h" x1="20" y1="20" x2="20" y2="11"/><line class="hand hand-m" id="hm" x1="20" y1="20" x2="20" y2="6"/></svg></div>
      <div class="tray" aria-live="polite"><span class="slot" data-k="shoe">👠</span>${'<span class="slot" data-k="star">⭐</span>'.repeat(5)}</div>
      <div class="secs"><b id="secs">${LIMIT}</b><small>ثانية</small></div>
    </div>
    <div class="ballroom" id="room"></div>`;
  const room = $('#room', root);
  const hm = $('#hm', root);
  const secsEl = $('#secs', root);
  const clock = $('#clock', root);
  let timer = 0;
  let found = 0;
  let over = false;

  function setup() {
    clearInterval(timer);
    over = false;
    found = 0;
    $$('.slot', root).forEach((s) => s.classList.remove('on'));
    clock.classList.remove('urgent');
    const cols = 6;
    const rows = 6;
    const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, 28);
    const things = shuffle([['shoe', '👠'], ...Array(5).fill(['star', '⭐']), ...shuffle(decoys).map((d) => ['no', d])].slice(0, 28));
    room.innerHTML = cells.map((cell, k) => {
      const [kind, e] = things[k];
      const c = cell % cols;
      const r = Math.floor(cell / cols);
      const left = ((c + rand(0.3, 0.7)) / cols) * 100;
      const top = ((r + rand(0.3, 0.7)) / rows) * 100;
      const fs = kind === 'star' ? rand(17, 22) : kind === 'shoe' ? 24 : rand(20, 30);
      const op = kind === 'no' ? 1 : rand(0.7, 0.9);
      return `<button class="hid" type="button" data-k="${kind}" aria-label="${kind === 'no' ? 'زينة' : kind === 'shoe' ? 'فردة الجزمة' : 'نجمة'}" style="left:${left}%;top:${top}%;--fs:${fs}px;--rot:${rand(-30, 30)}deg;--op:${op}">${e}</button>`;
    }).join('');
    $$('.hid', room).forEach((b) => b.addEventListener('click', () => onTap(b)));
    let elapsed = 0;
    secsEl.textContent = LIMIT;
    hm.style.transition = 'none';
    hm.style.transform = 'rotate(-90deg)';
    void hm.getBoundingClientRect();
    hm.style.transition = '';
    timer = setInterval(() => {
      elapsed++;
      const left = LIMIT - elapsed;
      secsEl.textContent = left;
      hm.style.transform = `rotate(${-90 + (90 * elapsed) / LIMIT}deg)`;
      if (left <= 10) { clock.classList.add('urgent'); sfx.tick(); }
      if (left <= 0) lose();
    }, 1000);
  }
  function onTap(b) {
    if (over) return;
    const k = b.dataset.k;
    if (k === 'no') {
      b.classList.remove('miss');
      void b.offsetWidth;
      b.classList.add('miss');
      sfx.tap();
      return;
    }
    b.classList.add('found');
    const slot = $(`.slot[data-k="${k}"]:not(.on)`, root);
    slot?.classList.add('on');
    sparkleEl(b, ['#ffffff', '#f5dc8f', '#bfe6ff']);
    sfx.good();
    buzz(20);
    found++;
    if (found === 6) {
      over = true;
      clearInterval(timer);
      clock.classList.remove('urgent');
      setTimeout(done, 800);
    }
  }
  function lose() {
    over = true;
    clearInterval(timer);
    sfx.bell();
    buzz([200, 100, 200]);
    room.insertAdjacentHTML('beforeend', `<div class="lose"><strong>الساعة دقت ١٢!</strong><p>السحر خلص المرة دي.. بس سندريلا دايما بتلاقي طريقها</p><button class="btn gold" type="button" id="retry">جربي تاني</button></div>`);
    $('#retry', room).addEventListener('click', setup);
  }
  setup();
  return () => clearInterval(timer);
}

/* ---------- stage 5: memory box riddle ---------- */
function playBox(root, done) {
  const P = { moana: ['موانا', '🌊'], rapunzel: ['روبانزل', '🏮'], elsa: ['إيلسا', '❄️'], cinderella: ['سندريلا', '👠'], belle: ['بيل', '🌹'], ariel: ['آرييل', '🧜‍♀️'] };
  const answer = ['moana', 'rapunzel', 'elsa', 'cinderella'];
  const clues = ['المحيط اختارها', 'شعرها أطول من البرج', 'قلبها تلج بس دافي', 'نسيت جزمتها على السلم'];
  root.innerHTML = `
    <div class="giftbox" id="gift" aria-hidden="true"><div class="beams"></div><div class="box"><div class="ribbon"></div></div><div class="lid"></div><div class="lock">🔒</div></div>
    <p class="riddle">رتبي أميرات حكايتنا في الخانات حسب الألغاز عشان الصندوق يتفتح</p>
    <ol class="slots">${clues.map((c, i) => `<li><button class="pslot" type="button" data-i="${i}" aria-label="خانة ${i + 1}: ${c}"><span class="pnum">${i + 1}</span><span class="pval">?</span><span class="pname"></span></button><small>${c}</small></li>`).join('')}</ol>
    <div class="tokens">${shuffle(Object.keys(P)).map((k) => `<button class="token" type="button" data-k="${k}"><span>${P[k][1]}</span>${P[k][0]}</button>`).join('')}</div>`;
  const slots = $$('.pslot', root);
  const tokens = $$('.token', root);
  const gift = $('#gift', root);
  const filled = [null, null, null, null];
  let locked = false;
  const timers = [];

  function paint() {
    const next = filled.indexOf(null);
    slots.forEach((s, i) => {
      const k = filled[i];
      s.classList.toggle('filled', !!k);
      s.classList.toggle('next', i === next);
      $('.pval', s).textContent = k ? P[k][1] : '?';
      $('.pname', s).textContent = k ? P[k][0] : '';
    });
    tokens.forEach((t) => t.classList.toggle('used', filled.includes(t.dataset.k)));
  }
  function check() {
    const wrong = filled.map((k, i) => k !== answer[i]);
    if (!wrong.some(Boolean)) {
      locked = true;
      slots.forEach((s) => s.classList.add('right'));
      sfx.win();
      buzz([30, 40, 30, 40, 80]);
      gift.classList.add('open');
      const [x, y] = centerOf(gift);
      timers.push(setTimeout(() => {
        emit(x, y - 20, { n: 40, speed: 6, g: 0.06, life: 90, colors: ['#ff4d6d', '#e01e37', '#ff8fa3'], shape: 'heart', size: 2.5 });
        emit(x, y - 20, { n: 50, speed: 5, g: 0.04, life: 80 });
      }, 400));
      timers.push(setTimeout(done, 1900));
      return;
    }
    sfx.bad();
    buzz([60, 40, 60]);
    gift.classList.remove('shake');
    void gift.offsetWidth;
    gift.classList.add('shake');
    slots.forEach((s, i) => s.classList.toggle('wrong', wrong[i]));
    locked = true;
    timers.push(setTimeout(() => {
      wrong.forEach((w, i) => { if (w) filled[i] = null; });
      slots.forEach((s) => s.classList.remove('wrong'));
      locked = false;
      paint();
    }, 800));
  }
  tokens.forEach((t) => t.addEventListener('click', () => {
    if (locked) return;
    const i = filled.indexOf(null);
    if (i < 0) return;
    filled[i] = t.dataset.k;
    sfx.tap();
    buzz(10);
    paint();
    if (!filled.includes(null)) timers.push(setTimeout(check, 350));
  }));
  slots.forEach((s, i) => s.addEventListener('click', () => {
    if (locked || !filled[i]) return;
    filled[i] = null;
    sfx.tap();
    paint();
  }));
  paint();
  return () => timers.forEach(clearTimeout);
}

/* ---------- stage 6: grand celebration ---------- */
function playParty(root, done) {
  const GOAL = 12;
  let n = 0;
  root.innerHTML = `
    <div class="party-meter panel"><div class="big-heart" id="bh"><svg class="empty" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg><svg class="full" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg></div><p aria-live="polite"><b id="pc">0</b> / ${GOAL} قلب</p></div>
    <div class="sky party-sky" id="psky"></div>`;
  const sky = $('#psky', root);
  const bh = $('#bh', root);
  const timers = [];
  const auto = setInterval(() => { firework(rand(W * 0.15, W * 0.85), rand(H * 0.12, H * 0.4)); sfx.boom(); }, 1800);
  const fl = floaters(sky, {
    every: 620,
    speed: [65, 105],
    make() {
      if (n >= GOAL) return null;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'floater heart-item';
      el.style.color = pick(['#e01e37', '#ff4d6d', '#d4af37', '#ff8fa3']);
      el.setAttribute('aria-label', 'قلب طاير');
      el.innerHTML = `<span class="bubble">${HEART_SVG}</span>`;
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        if (n >= GOAL) return;
        fl.pop(el);
        el.classList.add('good');
        timers.push(setTimeout(() => el.remove(), 450));
        n++;
        $('#pc', root).textContent = n;
        bh.style.setProperty('--p', `${100 - (n / GOAL) * 100}%`);
        firework(...centerOf(el));
        sfx.boom();
        sfx.chime(n % 9);
        buzz(25);
        if (n === GOAL) {
          fl.stop();
          clearInterval(auto);
          for (let i = 0; i < 6; i++) timers.push(setTimeout(() => { firework(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.5)); sfx.boom(); }, i * 220));
          confetti(180);
          timers.push(setTimeout(done, 1800));
        }
      }, { once: true });
      return el;
    },
  });
  return () => { fl.stop(); clearInterval(auto); timers.forEach(clearTimeout); };
}

/* ---------- stages data ---------- */
const STAGES = [
  {
    title: 'مغامرة موانا والمحيط', icon: '🌊', theme: 'ocean', play: playOcean,
    hint: 'اقلبي الكروت وطابقي كل اتنين شبه بعض عشان نجمع وليمة السي فود',
    msg: 'انتي مش بس حاجة حلوة حصلتلي أنتي العمر كله اللي اتغير من يوم ما دخلتي حياتي اتكتبلي عمر جديد احلى بكتيييير في حنية اكتر بكتييير ودفى احلى طريق ومشوار ممكن يتكتب انتي مش مجرد شخص بحبه أنتي الحلم اللي ما مكنتش حرفيا أجرؤ أتمناه واحلى حاجة حصلتلي احلى حاجة بقت بتاعتي في يوم كل تفصيلة فيكي بتخليني أتأكد إن ربنا بيحبني عشان بعتك ليا أنتي الأمان اللي بدور عليه طول عمري والضحكة اللي بتنور أضلم أيامي إني هفضل أحبك بكل حيلتي وبكل طاقتي لآخر نفس في حياتي ومفيش حاجة في الدنيا دي كلها تقدر تاخد مكانك أو تعوّض غيابك لحظة واحدة',
  },
  {
    title: 'مطبخ روبانزل والبرج', icon: '🏮', theme: 'tower', play: playTower,
    hint: 'الفوانيس شايلة المكونات.. اضغطي بس على مكونات الوصفة',
    msg: 'انتي النعمة الحلوة اللي بتمنى من ربنا يديمها عليا طول العمر وجودك في أيامي هو السند والراحة اللي دايما بدور عليها وبطمن اول ما اسمع صوتك بحبك فوق ما تتخيلي وبوعدك اني هفضل جنبك خطوة بخطوة ومش هسيب ايدك ابدا لحد ما نتجمع في بيت واحد ونسقف لنجاحنا ونحقق كل احلامنا سوا انتي حبيبتي ودنيتي كلها ومافيش حاجة في الدنيا دي تقدر تاخد مكانك',
  },
  {
    title: 'قصر الجليد مع إيلسا', icon: '❄️', theme: 'ice', play: playIce,
    hint: 'اتفرجي على البلورات اللي بتنور وكرريها بنفس الترتيب عشان تكوني ٣ قلوب جليدية',
    msg: 'كل يوم بيعدي عليا وانتي معايا بتاكد اني اخترت صح وان قلبي ما حبش حد زيك ولا هيحب كل تفصيلة فيكي بتخطف قلبي من جديد وانتي الامان اللي بيهون عليا اي تعب انا دايما معاكي وسندك وحمايتك في كل لحظة ومش هيرتاح بالي غير لما تبقي حلالي وفي بيتي واخدك في حضني واقولك قدام الدنيا كلها اننا قدرنا ونعدي كل الصعاب سوا يا احلى حاجة حصلت في عمري',
  },
  {
    title: 'حفلة سندريلا والساعة الرنانة', icon: '👠', theme: 'ball', play: playBall,
    hint: 'دوري على فردة الجزمة الزجاج و٥ نجوم متخبيين قبل ما الساعة تدق ١٢',
    msg: 'حبيبتي ودلوعتي وعمري كله انتي مش بس حب حياتي انتي الروح اللي بعيش بيها والضحكة اللي بتنورلي الطريق مهما الدنيا ضاقت بيا وجودك جنبي بيدينا طاقة وقوة ومش هسيبك ولا لحظة وهفضل واقف معاكي وفي ضهرك لحد ما نوصل لليوم اللي ندخل فيه بيتنا سوا ونبدا حياتنا الجديدة اللي كلها حنية ودفى انتي ملكتي وحبي الوحيد لآخر نفس في حياتي',
  },
  {
    title: 'صندوق الذكريات السحري', icon: '🎁', theme: 'box', play: playBox,
    hint: 'حلي لغز الأميرات عشان صندوق الذكريات يتفتح',
    msg: 'كل ثانية بتعدي وانا بفكر فيكي وفي اليوم اللي هصحى فيه الاوراضي جنبك وبتبصيلي بالضحكة دي انتي بطلة كل حكاياتي والسر اللي بيخليني اعافر واكمل بكل قوتي ومفيش قوة في العالم تقدر تبعدني عنك هفضل احميكي واحبك كل يوم اكتر من اليوم اللي قبله لحد ما نبني بيتنا السعيد مع بعض',
  },
  {
    title: 'الاحتفال الأسطوري الكبير', icon: '💖', theme: 'party', play: playParty,
    hint: 'اضغطي على القلوب الطايرة وولّعي سما الاحتفال بالألعاب النارية',
    msg: 'مبروك يا ملكتي انتي كسبتي اللعبة وكسبتي قلبي وعمري كله معاها اليوم ده بداية لوعد جديد اني هفضل جنبك وسندك وفارس احلامك لحد ما ندخل بيتنا سوا ونعيش مع بعض كل لحظة بحب ودفى انتي اميرتي الوحيدة ودلوعتي اللي مش هسيبها ابدا وبحبك من اول اللعبة لحد اخر العمر',
  },
];
const ORDINALS = ['الأولى', 'التانية', 'التالتة', 'الرابعة', 'الخامسة', 'السادسة'];

/* ---------- flow ---------- */
const stageEl = $('#stage');
const stepsEl = $('#steps');
const fillEl = $('#progress-fill');
const modal = $('#modal');
const modalMsg = $('#modal-msg');
let current = 0;
let cleanup = null;
let won = false;
let modalAction = null;
let endingFx = 0;

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
function renderProgress(completed) {
  stepsEl.innerHTML = STAGES.map((s, i) => {
    const cls = i < completed ? 'done' : i === current ? 'now' : '';
    return `<li class="${cls}" aria-label="المرحلة ${ORDINALS[i]}${i < completed ? ' - خلصت' : i === current ? ' - الحالية' : ''}">${i < completed ? '&#10003;' : s.icon}</li>`;
  }).join('');
  fillEl.style.width = `${(Math.min(completed, STAGES.length - 1) / (STAGES.length - 1)) * 100}%`;
}

function startStage(i) {
  cleanup?.();
  cleanup = null;
  current = i;
  won = false;
  const s = STAGES[i];
  setTheme(s.theme);
  show('game');
  renderProgress(i);
  stageEl.innerHTML = `
    <div class="stage-head"><span class="stage-num">المرحلة ${ORDINALS[i]} من ٦</span><h2>${s.icon} ${s.title}</h2><p class="hint">${s.hint}</p></div>
    <div class="stage-body"></div>`;
  cleanup = s.play($('.stage-body', stageEl), () => winStage(i)) ?? null;
}

function winStage(i) {
  if (won) return;
  won = true;
  sfx.win();
  buzz([30, 40, 30]);
  renderProgress(i + 1);
  confetti(i === STAGES.length - 1 ? 200 : 90);
  const last = i === STAGES.length - 1;
  setTimeout(() => openModal({
    icon: last ? '👑' : '💌',
    kicker: last ? 'الرسالة الكبرى' : `رسالة المرحلة ${ORDINALS[i]}`,
    title: last ? 'لملكتي وأميرتي' : 'من قلبي ليكي',
    text: STAGES[i].msg,
    btn: last ? 'افتحي الخاتمة' : 'كملي الحكاية',
    big: last,
    onClose: () => (last ? showEnding() : startStage(i + 1)),
  }), 900);
}

function openModal({ icon, kicker, title, text, btn, big, onClose }) {
  $('#modal-icon').textContent = icon;
  $('#modal-kicker').textContent = kicker;
  $('#modal-title').textContent = title;
  $('#modal-btn').textContent = btn;
  modal.classList.toggle('big', !!big);
  modalMsg.classList.remove('instant');
  modalMsg.innerHTML = text.split(/\s+/).map((w, k) => `<span class="w" style="--d:${(k * 0.06).toFixed(2)}s">${w}</span>`).join(' ');
  modalMsg.scrollTop = 0;
  modalAction = onClose;
  modal.hidden = false;
  if (big) {
    for (let k = 0; k < 4; k++) setTimeout(() => firework(rand(W * 0.15, W * 0.85), rand(H * 0.05, H * 0.25)), k * 350);
  }
  $('#modal-btn').focus({ preventScroll: true });
}
modalMsg.addEventListener('click', () => modalMsg.classList.add('instant'));
$('#modal-btn').addEventListener('click', () => {
  sfx.tap();
  modal.hidden = true;
  const fn = modalAction;
  modalAction = null;
  fn?.();
});

function showEnding() {
  cleanup?.();
  cleanup = null;
  setTheme('party');
  show('ending');
  confetti(220);
  clearInterval(endingFx);
  endingFx = setInterval(() => {
    firework(rand(W * 0.1, W * 0.9), rand(H * 0.08, H * 0.4));
    if (Math.random() < 0.3) confetti(40);
  }, 1100);
}

$('#start-btn').addEventListener('click', () => {
  tone(1, 0.01, 'sine', 0.0001);
  sfx.win();
  startStage(0);
});
$('#replay-btn').addEventListener('click', () => {
  clearInterval(endingFx);
  startStage(0);
});
$('#reread-btn').addEventListener('click', () => {
  const s = STAGES[STAGES.length - 1];
  openModal({ icon: '👑', kicker: 'الرسالة الكبرى', title: 'لملكتي وأميرتي', text: s.msg, btn: 'رجوع', big: true, onClose: null });
});
$('#sound-btn').addEventListener('click', (e) => {
  muted = !muted;
  e.currentTarget.setAttribute('aria-pressed', String(muted));
  e.currentTarget.setAttribute('aria-label', muted ? 'تشغيل الصوت' : 'كتم الصوت');
});
