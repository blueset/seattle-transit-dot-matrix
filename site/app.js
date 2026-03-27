(async function () {
  const resp = await fetch('data/fonts.json');
  const data = await resp.json();

  const REFERENCE_CHARS = [];
  // A-Z
  for (let i = 65; i <= 90; i++) REFERENCE_CHARS.push(String.fromCharCode(i));
  // a-z
  for (let i = 97; i <= 122; i++) REFERENCE_CHARS.push(String.fromCharCode(i));
  // 0-9
  for (let i = 48; i <= 57; i++) REFERENCE_CHARS.push(String.fromCharCode(i));

  const GLYPH_FONT_SIZE = {
    '7': 35,   // 7 dots * 5px = 35px
    '12': 36,  // 12 dots * 3px = 36px
    '14': 42,  // 14 dots * 3px = 42px
    '15': 45,  // 15 dots * 3px = 45px
    '16': 48,  // 16 dots * 3px = 48px
  };

  const FONT_FAMILY = {
    '7':  'Seattle Transit 7',
    '12': 'Seattle Transit 12',
    '14': 'Seattle Transit 14',
    '15': 'Seattle Transit 15',
    '16': 'Seattle Transit 16',
  };

  // Build a unicode-to-glyph-name lookup for each font
  function buildCharMap(fontData) {
    const map = {};
    for (const [name, glyph] of Object.entries(fontData.glyphs)) {
      if (glyph.unicode != null) {
        const ch = String.fromCodePoint(glyph.unicode);
        map[ch] = { name, ...glyph };
      }
    }
    return map;
  }

  // Build a lookup: glyph name -> [{setName, glyph}]
  function buildAlternatesMap(fontData) {
    const map = {};
    for (const [setName, chars] of Object.entries(fontData.alternates || {})) {
      for (const [name, glyph] of Object.entries(chars)) {
        if (!map[name]) map[name] = [];
        map[name].push({ setName, glyph });
      }
    }
    return map;
  }

  function renderGlyphGrid(fontId) {
    const grid = document.getElementById('glyph-grid');
    grid.innerHTML = '';
    const fontData = data.fonts[fontId];
    const charMap = buildCharMap(fontData);
    const altMap = buildAlternatesMap(fontData);
    const fontSize = GLYPH_FONT_SIZE[fontId];
    const dotHeight = fontData.dotHeight;
    const cellPx = fontSize / dotHeight;
    const rendered = new Set();

    // Helper: append a glyph cell + any alternates that follow it
    function appendWithAlts(ch, glyphName, glyph, featureSet) {
      const cell = createGlyphCell(ch, glyph, fontId, fontData, fontSize, cellPx, featureSet);
      grid.appendChild(cell);
      // If this is a base glyph (no featureSet), append its alternates
      if (!featureSet && glyphName && altMap[glyphName]) {
        for (const alt of altMap[glyphName]) {
          const altCh = alt.glyph.char || glyphName;
          const altCell = createGlyphCell(altCh, alt.glyph, fontId, fontData, fontSize, cellPx, alt.setName);
          grid.appendChild(altCell);
        }
      }
    }

    // Render reference characters (A-Za-z0-9) first
    for (const ch of REFERENCE_CHARS) {
      const glyph = charMap[ch];
      const glyphName = glyph ? glyph.name : null;
      appendWithAlts(ch, glyphName, glyph, null);
      if (glyph) rendered.add(ch);
    }

    // Render remaining glyphs (punctuation, special chars, unicode)
    for (const [name, glyph] of Object.entries(fontData.glyphs)) {
      const ch = glyph.char || name;
      if (rendered.has(ch)) continue;
      if (name === 'space' || name === 'hairspace' || name === 'thinspace') continue;
      appendWithAlts(ch, name, glyph, null);
    }
  }

  function createGlyphCell(ch, glyph, fontId, fontData, fontSize, cellPx, featureSet) {
    const cell = document.createElement('div');
    cell.className = 'glyph-cell' + (glyph ? '' : ' placeholder');

    const display = document.createElement('div');
    display.className = 'glyph-display';

    const dotHeight = fontData.dotHeight;
    display.style.setProperty('--dot-height', dotHeight);
    display.style.fontFamily = `'${FONT_FAMILY[fontId]}', monospace`;
    display.style.fontSize = `${fontSize}px`;

    if (featureSet) {
      display.style.fontFeatureSettings = `"${featureSet}"`;
    }

    if (glyph) {
      display.textContent = ch;
      // Set explicit width based on glyph width in dots (+ 1 for right bearing)
      const widthDots = glyph.width + 1;
      display.style.width = `${widthDots * cellPx}px`;
      display.style.height = `${dotHeight * cellPx}px`;
    } else {
      display.textContent = ch;
      display.style.fontSize = '1.2rem';
      display.style.height = `${dotHeight * cellPx}px`;
      display.style.display = 'flex';
      display.style.alignItems = 'center';
      display.style.justifyContent = 'center';
    }

    const label = document.createElement('div');
    label.className = 'glyph-label';
    if (featureSet && glyph) {
      label.textContent = `${ch} (${featureSet})`;
    } else if (glyph && glyph.unicode != null) {
      label.textContent = `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, '0')}`;
    } else {
      label.textContent = ch;
    }

    cell.appendChild(display);
    cell.appendChild(label);
    return cell;
  }

  // Font selector buttons
  const buttons = document.querySelectorAll('.font-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGlyphGrid(btn.dataset.font);
    });
  });

  // Initial render
  renderGlyphGrid('7');

  // Prevent contenteditable from inserting divs on Enter
  document.querySelectorAll('.tester-input').forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
    // Strip formatting on paste
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  });
})();
