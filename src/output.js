const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const { getOutputFormat, isQuiet } = require('./config');

/**
 * Output utilities for CLI
 * Handles formatting output as tables, JSON, or plain text
 */

// ─────────────────────────────────────────────────────────
// Brand Colors
// ─────────────────────────────────────────────────────────
// Raw hex values — single source of truth for brand colors
const brandHex = {
  purple: '#ac9fe0',
  cyan: '#bdedfa',
  shadow: '#3d3466',
};

const brand = {
  hex: brandHex,
  purple: chalk.hex(brandHex.purple),
  purpleBold: chalk.hex(brandHex.purple).bold,
  mid: chalk.hex('#b5a8e3'),
  light: chalk.hex('#cdc3ec'),
  cyan: chalk.hex(brandHex.cyan),
  cyanBold: chalk.hex(brandHex.cyan).bold,
  // Gradient steps for decorative elements
  gradient: [
    chalk.hex(brandHex.purple),
    chalk.hex('#b5a8e3'),
    chalk.hex('#bdb1e6'),
    chalk.hex('#c5bae9'),
    chalk.hex('#cdc3ec'),
    chalk.hex(brandHex.cyan),
  ],
};

// ─────────────────────────────────────────────────────────
// Spinners
// ─────────────────────────────────────────────────────────
function createSpinner(text) {
  return ora({
    text,
    color: 'magenta',
    spinner: 'dots',
  });
}

// ─────────────────────────────────────────────────────────
// Status Colors
// ─────────────────────────────────────────────────────────
const statusColors = {
  // Scan statuses
  completed: chalk.green,
  running: chalk.blue,
  queued: chalk.yellow,
  failed: chalk.red,
  cancelled: chalk.gray,
  cloning: brand.purple,
  initializing: brand.purple,
  planning: brand.purple,
  analyzing: brand.purple,

  // Drift statuses
  detected: chalk.yellow,
  analyzed: chalk.blue,
  resolved: chalk.green,
  ignored: chalk.gray,
  wont_fix: chalk.gray,
  fixing: brand.purple,
  pr_created: chalk.magenta,

  // Severity
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,

  // Runner statuses
  online: chalk.green,
  offline: chalk.red,
  busy: chalk.yellow,

  // Generic
  active: chalk.green,
  inactive: chalk.gray,
  pending: chalk.yellow,
  success: chalk.green,
  error: chalk.red,
};

function colorStatus(status) {
  const colorFn = statusColors[status?.toLowerCase()] || chalk.white;
  return colorFn(status);
}

// ─────────────────────────────────────────────────────────
// Table Formatting
// ─────────────────────────────────────────────────────────
function createTable(headers, options = {}) {
  return new Table({
    head: headers.map((h) => brand.purpleBold(h)),
    style: {
      head: [],
      border: [],
    },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
    ...options,
  });
}

// ─────────────────────────────────────────────────────────
// Output Functions
// ─────────────────────────────────────────────────────────
function output(data, options = {}) {
  const format = getOutputFormat(options);

  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Default: print as-is
  console.log(data);
}

function outputTable(headers, rows, options = {}) {
  const format = getOutputFormat(options);

  if (format === 'json') {
    // Convert to array of objects
    const data = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.toLowerCase().replace(/\s+/g, '_')] = row[i];
      });
      return obj;
    });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Table format
  const table = createTable(headers);
  rows.forEach((row) => table.push(row));
  console.log(table.toString());
}

function outputSuccess(message, options = {}) {
  if (!isQuiet(options)) {
    console.log(chalk.green('✓'), message);
  }
}

function outputError(message, _options = {}) {
  console.error(chalk.red('✗'), message);
}

function outputWarning(message, options = {}) {
  if (!isQuiet(options)) {
    console.log(chalk.yellow('!'), message);
  }
}

function outputInfo(message, options = {}) {
  if (!isQuiet(options)) {
    console.log(brand.purple('ℹ'), message);
  }
}

// ─────────────────────────────────────────────────────────
// Data Formatting Helpers
// ─────────────────────────────────────────────────────────
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date) {
  if (!date) return '-';
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function formatDuration(ms) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function truncate(str, length = 40) {
  if (!str) return '-';
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}

// ─────────────────────────────────────────────────────────
// Box/Card Output
// ─────────────────────────────────────────────────────────

// Strip ANSI escape codes to get visible string length
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visibleLength(str) {
  return stripAnsi(str).length;
}

function padEndVisible(str, targetLength) {
  const visible = visibleLength(str);
  const padding = Math.max(0, targetLength - visible);
  return str + ' '.repeat(padding);
}

function outputBox(title, content) {
  const width = 60;
  const border = '─'.repeat(width - 2);

  console.log(brand.purple(`┌${border}┐`));
  console.log(brand.purple('│') + brand.cyanBold(` ${title}`.padEnd(width - 2)) + brand.purple('│'));
  console.log(brand.purple(`├${border}┤`));

  const lines = content.split('\n');
  lines.forEach((line) => {
    const paddedLine = padEndVisible(` ${line}`, width - 2);
    console.log(brand.purple('│') + paddedLine + brand.purple('│'));
  });

  console.log(brand.purple(`└${border}┘`));
}

// ─────────────────────────────────────────────────────────
// Progress Indicator
// ─────────────────────────────────────────────────────────
function outputProgress(current, total, label = '') {
  const percentage = Math.round((current / total) * 100);
  const barWidth = 30;
  const filled = Math.round((current / total) * barWidth);
  const empty = barWidth - filled;

  const bar = brand.purple('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  process.stdout.write(`\r${bar} ${percentage}% ${label}`);

  if (current >= total) {
    console.log(); // New line when complete
  }
}

module.exports = {
  brand,
  createSpinner,
  colorStatus,
  statusColors,
  createTable,
  output,
  outputTable,
  outputSuccess,
  outputError,
  outputWarning,
  outputInfo,
  outputBox,
  outputProgress,
  formatDate,
  formatRelativeTime,
  formatDuration,
  truncate,
};
