// ─── SCROLL & ACTIVE NAV ───

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

// Devuelve la distancia acumulada desde el tope de #main hasta el elemento.
// Sube por offsetParent hasta encontrar #main.
// Si no lo encuentra (edge case de layout), usa getBoundingClientRect como fallback.
function offsetFromMain(el) {
  let top = 0;
  let node = el;
  while (node && node !== mainEl) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  // Si no llegó a mainEl, fallback con getBoundingClientRect
  if (node !== mainEl) {
    return el.getBoundingClientRect().top
      - mainEl.getBoundingClientRect().top
      + mainEl.scrollTop;
  }
  return top;
}

function navTo(id) {
  const target = document.getElementById(id);
  if (!target) return;
  mainEl.scrollTo({ top: offsetFromMain(target) - 16, behavior: 'smooth' });
}

mainEl.addEventListener('scroll', () => {
  let active = 'hero';
  const scrollPos = mainEl.scrollTop + 110;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (offsetFromMain(el) <= scrollPos) active = id;
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

// ─── SAVE INITIAL EDITOR CONTENT AS DEFAULTS ───
const defaults = {};
document.querySelectorAll('.code-editor').forEach(ed => {
  const id = ed.id.replace('ed-', '');
  defaults[id] = ed.value;
});

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

  // Sincronizar hover después de cada aplicación
  syncHover(id);
}

// ─── RESET ───
function resetEditor(id) {
  const editor = document.getElementById(`ed-${id}`);
  if (!editor || !defaults[id]) return;
  editor.value = defaults[id];
  // Reset shape to square before applying
  setShape(id, 'square');
  applyCSS(id); // applyCSS ya llama syncHover internamente
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
  const obj   = document.getElementById('obj-combos');
  const shape = shapeState['combos'] || 'square';
  const w  = (obj && shape !== 'text') ? obj.style.width  || '65px' : '65px';
  const h  = (obj && shape !== 'text') ? obj.style.height || '65px' : '65px';
  const bg = (obj && shape !== 'text') ? obj.style.background || '#7c6aff' : '#7c6aff';
  const br = (shape === 'circle') ? '50%' : (obj ? obj.style.borderRadius || '8px' : '8px');

  // Poner transform directo en el bloque base — visible siempre, sin hover
  // (las cards son comparación rápida, no demo de hover)
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


// ─── HOVER desde el editor ───
// Si el usuario escribe .elemento:hover { ... } en el editor,
// el preview reacciona. Sin ese bloque, no pasa nada.

function parseHoverBlock(css) {
  const re = /\.elemento\s*:hover\s*\{([^}]*)\}/s;
  const match = css.match(re);
  if (!match) return null;
  const props = {};
  match[1].split(';').forEach(line => {
    const [k, ...v] = line.split(':');
    const key = k && k.trim();
    const val = v.join(':').trim();
    if (key && val) props[key] = val;
  });
  return Object.keys(props).length ? props : null;
}

// Guarda el estado base de estilos del objeto para poder restaurarlo
function captureBaseStyle(obj) {
  return obj.getAttribute('style') || '';
}

// Inicializar hover en todos los playgrounds al cargar y al aplicar CSS
function syncHover(id) {
  const ed   = document.getElementById(`ed-${id}`);
  const obj  = document.getElementById(`obj-${id}`);
  const prev = document.getElementById(`prev-${id}`);
  if (!ed || !obj || !prev) return;

  // Quitar listeners anteriores
  if (prev._hoverEnter) prev.removeEventListener('mouseenter', prev._hoverEnter);
  if (prev._hoverLeave) prev.removeEventListener('mouseleave', prev._hoverLeave);
  prev._hoverEnter = null;
  prev._hoverLeave = null;

  const hoverProps = parseHoverBlock(ed.value);

  // Buscar o crear badge — está en el pane-header del PANE que contiene prev-*
  const pane = prev.parentElement; // .pane
  const paneHeader = pane ? pane.querySelector('.pane-header .pane-title') : null;
  let badge = pane ? pane.querySelector('.hover-badge') : null;

  if (!hoverProps) {
    // Sin :hover — limpiar
    prev.style.cursor = '';
    if (badge) badge.remove();
    return;
  }

  // Crear badge si no existe
  if (!badge && paneHeader) {
    badge = document.createElement('span');
    badge.className = 'hover-badge';
    badge.style.marginLeft = '0.6rem';
    paneHeader.appendChild(badge);
  }
  if (badge) badge.textContent = ':hover ▸';

  prev.style.cursor = 'pointer';

  // Al entrar: aplicar props del :hover encima del estado actual
  prev._hoverEnter = () => {
    // Re-parsear en el momento para tener el valor más reciente
    const liveHover = parseHoverBlock(ed.value);
    if (!liveHover) return;
    Object.entries(liveHover).forEach(([k, v]) => {
      obj.style[camelCase(k)] = v;
    });
  };

  // Al salir: restaurar el estado base (.elemento sin hover)
  prev._hoverLeave = () => {
    const baseProps = parseCSSBlock(ed.value, '.elemento');
    // Lista de todas las props que el :hover pudo haber cambiado
    const liveHover = parseHoverBlock(ed.value) || {};
    Object.keys(liveHover).forEach(k => {
      // Restaurar al valor base, o '' si no estaba definido
      obj.style[camelCase(k)] = baseProps[k] || '';
    });
  };

  prev.addEventListener('mouseenter', prev._hoverEnter);
  prev.addEventListener('mouseleave', prev._hoverLeave);
}

// Inicializar al cargar — aplicar estado base de cada editor
document.querySelectorAll('.code-editor').forEach(ed => {
  const id = ed.id.replace('ed-', '');
  // Aplicar el CSS base (sin hover) al objeto de preview
  applyCSS(id); // esto también llama syncHover internamente
  // Re-sincronizar mientras escribe (debounce 350ms)
  let t;
  ed.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => syncHover(id), 350);
  });
});