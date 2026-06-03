// ─── SCROLL & ACTIVE NAV ───
// getBoundingClientRect gives position relative to viewport — always reliable.
// We add main.scrollTop to convert to "scroll position" coordinates.

const mainEl   = document.getElementById('main');
const navItems = document.querySelectorAll('.nav-item');

const sections = [
  'hero','translate','translateXY','translateZ',
  'scale','scaleXY','scaleZ',
  'rotate','rotateXY','rotate3d',
  'skew','skewXY',
  'matrix','matrix3d',
  'transform-origin','transform-style','perspective','perspective-origin','backface',
  'combos'
];

function getScrollTop(el) {
  // Distance from top of #main scroll container to the element
  return el.getBoundingClientRect().top - mainEl.getBoundingClientRect().top + mainEl.scrollTop;
}

function navTo(id) {
  const target = document.getElementById(id);
  if (!target) return;
  mainEl.scrollTo({ top: getScrollTop(target) - 16, behavior: 'smooth' });
}

mainEl.addEventListener('scroll', () => {
  let active = 'hero';
  const threshold = mainEl.getBoundingClientRect().top + 120; // px from top of viewport
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.getBoundingClientRect().top <= threshold) active = id;
  });
  navItems.forEach(item => {
    item.classList.remove('active');
    const fn = item.getAttribute('onclick') || '';
    if (fn.includes(`'${active}'`)) item.classList.add('active');
  });
});

// ─── SHAPE STATE ───
// Tracks current shape per playground id
const shapeState = {};

// ─── PARSE CSS BLOCK ───
function parseCSSBlock(css, selector = '.elemento') {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{([^}]*)\\}', 's');
  const match = css.match(re);
  if (!match) return {};
  const props = {};
  match[1].split(';').forEach(line => {
    const [k, ...v] = line.split(':');
    if (k && v.length) {
      props[k.trim()] = v.join(':').trim();
    }
  });
  return props;
}

function parsePadreBlock(css) {
  const re = /\.padre\s*\{([^}]*)\}/s;
  const match = css.match(re);
  if (!match) return {};
  const props = {};
  match[1].split(';').forEach(line => {
    const [k, ...v] = line.split(':');
    if (k && v.length) props[k.trim()] = v.join(':').trim();
  });
  return props;
}

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
}

// ─── APPLY CSS ───
// Applies editor CSS to the preview object while respecting the current shape
function applyCSS(id) {
  const editor = document.getElementById(`ed-${id}`);
  const obj    = document.getElementById(`obj-${id}`);
  const ghost  = document.getElementById(`ghost-${id}`);
  const label  = document.getElementById(`label-${id}`);
  const prev   = document.getElementById(`prev-${id}`);
  if (!editor || !obj) return;

  const css   = editor.value;
  const props = parseCSSBlock(css, '.elemento');
  const shape = shapeState[id] || 'square';

  // --- Geometry (width / height) ---
  // Always apply from editor unless shape is 'text'
  if (shape !== 'text') {
    if (props['width'])  obj.style.width  = props['width'];
    if (props['height']) obj.style.height = props['height'];
  }

  // --- Visual props (skip background/color/border-radius when text shape) ---
  const visualKeys = ['border','opacity','box-shadow','padding','letter-spacing'];
  visualKeys.forEach(k => {
    if (props[k]) obj.style[camelCase(k)] = props[k];
  });

  if (shape !== 'text') {
    if (props['background'])   obj.style.background   = props['background'];
    if (props['color'])        obj.style.color        = props['color'];
    if (props['font-size'])    obj.style.fontSize     = props['font-size'];
    if (props['font-weight'])  obj.style.fontWeight   = props['font-weight'];
    // border-radius from editor only for square; circle keeps 50%
    if (shape === 'square' && props['border-radius']) {
      obj.style.borderRadius = props['border-radius'];
    }
  }

  // --- Transform properties (always apply) ---
  if (props['transform'])           obj.style.transform          = props['transform'];
  if (props['transform-origin'])    obj.style.transformOrigin    = props['transform-origin'];
  if (props['transform-style'])     obj.style.transformStyle     = props['transform-style'];
  if (props['backface-visibility']) obj.style.backfaceVisibility = props['backface-visibility'];

  // --- Ghost: sync size/shape ---
  if (ghost && shape !== 'text') {
    ghost.style.display = '';
    if (props['width'])  ghost.style.width  = props['width'];
    if (props['height']) ghost.style.height = props['height'];
    if (shape === 'square' && props['border-radius']) ghost.style.borderRadius = props['border-radius'];
    if (shape === 'circle') ghost.style.borderRadius = '50%';
  }

  // --- perspective-origin parent ---
  if (id === 'porigin') {
    const padreProps = parsePadreBlock(css);
    if (padreProps['perspective-origin'] && prev) {
      prev.style.perspectiveOrigin = padreProps['perspective-origin'];
      if (label) label.textContent = `perspective-origin: ${padreProps['perspective-origin']}`;
    }
  }

  // --- Label ---
  if (label && props['transform']) {
    label.textContent = `transform: ${props['transform']}`;
  }
}

// ─── RESET ───
function resetEditor(id) {
  const editor = document.getElementById(`ed-${id}`);
  if (!editor || !defaults[id]) return;
  editor.value = defaults[id];
  // Reset shape to square before applying
  setShape(id, 'square');
  applyCSS(id);
}

// ─── SHAPES ───
function setShape(id, shape) {
  shapeState[id] = shape;
  const obj   = document.getElementById(`obj-${id}`);
  const ghost = document.getElementById(`ghost-${id}`);
  if (!obj) return;

  // Read current size from editor so we don't lose it
  const editor = document.getElementById(`ed-${id}`);
  const props  = editor ? parseCSSBlock(editor.value, '.elemento') : {};
  const w = props['width']  || '65px';
  const h = props['height'] || '65px';
  const bg = props['background'] || '#7c6aff';
  const br = props['border-radius'] || '8px';

  // Clear all inline overrides first
  obj.removeAttribute('style');

  // Re-apply transform (must survive shape change)
  if (props['transform'])           obj.style.transform          = props['transform'];
  if (props['transform-origin'])    obj.style.transformOrigin    = props['transform-origin'];
  if (props['transform-style'])     obj.style.transformStyle     = props['transform-style'];
  if (props['backface-visibility']) obj.style.backfaceVisibility = props['backface-visibility'];

  if (shape === 'square') {
    obj.style.width        = w;
    obj.style.height       = h;
    obj.style.background   = bg;
    obj.style.borderRadius = br;
    obj.textContent        = '';
    if (ghost) {
      ghost.style.display      = '';
      ghost.style.width        = w;
      ghost.style.height       = h;
      ghost.style.borderRadius = br;
    }

  } else if (shape === 'circle') {
    obj.style.width        = w;
    obj.style.height       = w; // force square bounding box for circle
    obj.style.background   = bg;
    obj.style.borderRadius = '50%';
    obj.textContent        = '';
    if (ghost) {
      ghost.style.display      = '';
      ghost.style.width        = w;
      ghost.style.height       = w;
      ghost.style.borderRadius = '50%';
    }

  } else if (shape === 'text') {
    obj.style.width        = 'auto';
    obj.style.height       = 'auto';
    obj.style.background   = 'transparent';
    obj.style.color        = '#7c6aff';
    obj.style.fontSize     = '2rem';
    obj.style.fontFamily   = "'Syne', sans-serif";
    obj.style.fontWeight   = '800';
    obj.style.letterSpacing= '-0.02em';
    obj.style.whiteSpace   = 'nowrap';
    obj.textContent        = 'CSS';
    if (ghost) ghost.style.display = 'none';
  }

  // Update active button
  const btns = document.querySelectorAll(`#shapes-${id} .shape-btn`);
  btns.forEach(b => b.classList.remove('active'));
  const map = { square: 0, circle: 1, text: 2 };
  if (btns[map[shape]]) btns[map[shape]].classList.add('active');
}

// ─── PERSPECTIVE SLIDER ───
document.getElementById('persp-slider').addEventListener('input', function() {
  const val = this.value;
  document.getElementById('persp-val').textContent = val + 'px';
  document.getElementById('prev-persp').style.perspective = val + 'px';
});

// ─── LOAD COMBO PRESET ───
function loadCombo(transformVal) {
  const ed = document.getElementById('ed-combos');
  if (!ed) return;
  // Preserve current shape dimensions
  const obj   = document.getElementById('obj-combos');
  const shape = shapeState['combos'] || 'square';
  const w = (obj && shape !== 'text') ? obj.style.width  || '65px' : '65px';
  const h = (obj && shape !== 'text') ? obj.style.height || '65px' : '65px';
  const bg = (obj && shape !== 'text') ? obj.style.background || '#7c6aff' : '#7c6aff';
  const br = (shape === 'circle') ? '50%' : (obj ? obj.style.borderRadius || '8px' : '8px');
  ed.value = `.elemento {\n  transform: ${transformVal};\n\n  width: ${w};\n  height: ${h};\n  background: ${bg};\n  border-radius: ${br};\n}`;
  applyCSS('combos');
}

// ─── INJECT EDITOR HINTS (Ctrl+Enter tip) ───
document.querySelectorAll('.playground .pane').forEach(pane => {
  const ta = pane.querySelector('.code-editor');
  if (ta && !pane.querySelector('.editor-hint')) {
    const hint = document.createElement('div');
    hint.className = 'editor-hint';
    hint.innerHTML = '<span class="kbd">Ctrl</span> + <span class="kbd">Enter</span> para aplicar';
    pane.appendChild(hint);
  }
});

// ─── KEYBOARD SHORTCUTS ───
document.querySelectorAll('.code-editor').forEach(ed => {
  ed.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const id = this.id.replace('ed-', '');
      applyCSS(id);
      e.preventDefault();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end   = this.selectionEnd;
      this.value  = this.value.substring(0, start) + '  ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
    }
  });
});

// ─── EDITOR FOCUS HIGHLIGHT ───
document.querySelectorAll('.code-editor').forEach(ed => {
  ed.addEventListener('focus', function() {
    this.closest('.playground').style.outline = '1px solid rgba(124,106,255,0.35)';
  });
  ed.addEventListener('blur', function() {
    this.closest('.playground').style.outline = '';
  });
});
