const chalk = require('chalk');

// Uppercase block font — 6 rows tall, 5 chars wide (I: 4 wide)
const font = {
  C: [' ███ ', '██   ', '██   ', '██   ', '██   ', ' ███ '],
  O: [' ███ ', '██ ██', '██ ██', '██ ██', '██ ██', ' ███ '],
  N: ['██ ██', '███ █', '█████', '█ ███', '██ ██', '██ ██'],
  T: ['█████', ' ██  ', ' ██  ', ' ██  ', ' ██  ', ' ██  '],
  R: ['████ ', '██ ██', '████ ', '███  ', '██ █ ', '██ ██'],
  L: ['██   ', '██   ', '██   ', '██   ', '██   ', '█████'],
  I: ['████', ' ██ ', ' ██ ', ' ██ ', ' ██ ', '████'],
  F: ['█████', '██   ', '████ ', '██   ', '██   ', '██   '],
  A: [' ███ ', '██ ██', '█████', '██ ██', '██ ██', '██ ██'],
};

// Row brightness: top-lit 3D effect (bright top → darker bottom)
const ROW_BRIGHTNESS = [1.2, 1.1, 1.0, 0.9, 0.8, 0.7];
const SHADOW_COLOR = '#3d3466';

// Interpolate between two hex colors
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Apply brightness multiplier to a hex color
function applyBrightness(hex, bright) {
  const rr = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * bright));
  const gg = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * bright));
  const bb = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * bright));
  return '#' + [rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Render the "CONTROLINFRA" block-letter banner with 3D gradient
 * - Horizontal brand gradient (#ac9fe0 → #bdedfa)
 * - Vertical brightness (bright top → dark bottom) for 3D depth
 * - Half-block shadow row at bottom
 */
function gradientBanner() {
  const word = 'CONTROLINFRA';

  // Build each row by composing letter glyphs
  const rows = [];
  for (let r = 0; r < 6; r++) {
    let line = '';
    for (let ci = 0; ci < word.length; ci++) {
      if (ci > 0) line += ' ';
      line += font[word[ci]][r];
    }
    rows.push(line);
  }

  // Render with combined horizontal + vertical gradient
  console.log();
  const width = rows[0].length;
  rows.forEach((line, ri) => {
    let colored = '  ';
    const bright = ROW_BRIGHTNESS[ri];
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== ' ') {
        const t = width > 1 ? j / (width - 1) : 0;
        const base = lerpColor('#ac9fe0', '#bdedfa', t);
        colored += chalk.hex(applyBrightness(base, bright))('█');
      } else {
        colored += ' ';
      }
    }
    console.log(colored);
  });

  // Half-block shadow row for ground depth
  const lastRow = rows[5];
  let shadow = '  ';
  for (let j = 0; j < lastRow.length; j++) {
    shadow += lastRow[j] !== ' ' ? chalk.hex(SHADOW_COLOR)('▀') : ' ';
  }
  console.log(shadow);
}

module.exports = { gradientBanner };
