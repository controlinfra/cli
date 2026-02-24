const chalk = require('chalk');
const http = require('http');
const { execFile } = require('child_process');
const inquirer = require('inquirer');
const api = require('../api');
const { auth } = api;
const { saveAuth, clearAuth, getUser, isAuthenticated, getApiUrl, getConfigPath } = require('../config');
const { brand, createSpinner, outputError, outputInfo, outputBox } = require('../output');
const { gradientBanner } = require('../banner');
const { canOpenBrowser } = require('../utils/browser-detect');
const { getSuccessHtml, getErrorHtml } = require('./auth-html');

/**
 * Login to Controlinfra
 * Opens browser for OAuth or accepts token directly
 */
async function login(options) {
  // If token provided, use it directly
  if (options.token) {
    const spinner = createSpinner('Verifying token...').start();
    try {
      saveAuth({ token: options.token });
      const userData = await auth.getMe();
      saveAuth({ user: userData.user || userData });
      spinner.succeed('Logged in successfully');
      await showDashboard(userData.user || userData);
      return;
    } catch (error) {
      spinner.fail('Invalid token');
      clearAuth();
      process.exit(1);
    }
  }

  // Browser-based OAuth flow with local callback server
  console.log(chalk.bold('\n  Controlinfra Login\n'));

  if (!canOpenBrowser()) {
    console.log(chalk.dim('  No desktop environment detected.\n'));
    await manualTokenEntry();
    return;
  }

  try {
    const result = await browserAuthFlow();
    if (result.token) {
      const spinner = createSpinner('Verifying token...').start();
      try {
        saveAuth({ token: result.token });
        const userData = await auth.getMe();
        saveAuth({ user: userData.user || userData });
        spinner.succeed('Logged in successfully');
        await showDashboard(userData.user || userData);
      } catch (error) {
        spinner.fail('Authentication failed');
        clearAuth();
        outputError(error.message);
        process.exit(1);
      }
    }
  } catch (error) {
    // Fallback to manual token entry
    console.log(chalk.yellow('\n  Browser auth unavailable. Falling back to manual mode.\n'));
    await manualTokenEntry();
  }
}

/**
 * Browser auth flow with local callback server
 */
async function browserAuthFlow() {
  return new Promise((resolve, reject) => {
    // Find an available port
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const apiUrl = getApiUrl();
      const authUrl = `${apiUrl}/api/auth/github?cli=true&redirect_uri=${encodeURIComponent(callbackUrl)}`;

      console.log(chalk.dim('  Opening browser for GitHub authentication...\n'));
      console.log(chalk.dim('  If browser does not open, visit:'));
      console.log(brand.cyan(`  ${authUrl}\n`));

      // Open browser using native OS command (avoids 'open' npm dep for pkg builds)
      if (process.platform === 'win32') {
        // cmd.exe treats & as command separator; escape with ^ so the full URL opens
        execFile('cmd', ['/c', 'start', '', authUrl.replace(/&/g, '^&')]);
      } else {
        execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [authUrl]);
      }

      console.log(chalk.dim('  Waiting for authentication...'));
      console.log(chalk.dim('  Press Ctrl+C to cancel\n'));

      // Set timeout (2 minutes)
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 120000);

      // Handle incoming callback
      server.on('request', (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);

        if (url.pathname === '/callback') {
          const token = url.searchParams.get('token');
          const error = url.searchParams.get('error');

          clearTimeout(timeout);

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getErrorHtml(error));
            server.close();
            reject(new Error(error));
            return;
          }

          if (token) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getSuccessHtml());
            server.close();
            resolve({ token });
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getErrorHtml('No token received'));
          server.close();
          reject(new Error('No token received'));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
}

/**
 * Manual token entry fallback for headless environments
 */
async function manualTokenEntry() {
  const apiUrl = getApiUrl();
  let settingsUrl;
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    settingsUrl = 'http://localhost:5173/settings';
  } else if (apiUrl.includes('stage')) {
    settingsUrl = 'https://stage.controlinfra.com/settings';
  } else {
    settingsUrl = 'https://controlinfra.com/settings';
  }

  console.log(brand.purpleBold('  To authenticate on this machine:\n'));
  console.log(`  1. Go to ${brand.cyan(settingsUrl)}`);
  console.log(`  2. Navigate to ${chalk.bold('Integrations')} > ${chalk.bold('CLI API Tokens')}`);
  console.log('  3. Create a new token and copy it\n');
  console.log(chalk.dim(`  Or run: ${chalk.yellow('controlinfra login --token <your-token>')}\n`));

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Paste your CLI token:',
      mask: '*',
    },
  ]);

  if (!token) {
    outputError('No token provided');
    process.exit(1);
  }

  const spinner = createSpinner('Verifying token...').start();

  try {
    saveAuth({ token });
    const userData = await auth.getMe();
    saveAuth({ user: userData.user || userData });
    spinner.succeed('Logged in successfully');
    await showDashboard(userData.user || userData);
  } catch (error) {
    spinner.fail('Authentication failed');
    clearAuth();
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Logout - clear stored credentials
 */
async function logout() {
  if (!isAuthenticated()) {
    outputInfo('Not currently logged in');
    return;
  }

  const user = getUser();
  const spinner = createSpinner('Logging out...').start();

  try {
    // Try to invalidate session on server
    await auth.logout();
  } catch (error) {
    // Ignore errors - we'll clear local anyway
  }

  clearAuth();
  spinner.succeed('Logged out successfully');

  if (user?.displayName) {
    console.log(chalk.dim(`\nGoodbye, ${user.displayName}!\n`));
  }
}

/**
 * Show current authenticated user
 */
async function whoami(options) {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in\n'));
    console.log(chalk.dim('Run'), brand.cyan('controlinfra login'), chalk.dim('to authenticate\n'));
    return;
  }

  const spinner = createSpinner('Fetching user info...').start();

  try {
    const userData = await auth.getMe();
    const user = userData.user || userData;
    spinner.stop();

    // Update stored user info
    saveAuth({ user });

    if (options?.parent?.opts()?.json) {
      console.log(JSON.stringify(user, null, 2));
      return;
    }

    console.log();
    outputBox('Current User', [
      `Name:    ${brand.cyan(user.displayName || '-')}`,
      `Email:   ${user.email || '-'}`,
      `Role:    ${user.role || 'user'}`,
      `GitHub:  ${user.githubUsername || '-'}`,
    ].join('\n'));
    console.log();

    // Show quota info
    try {
      const quota = await auth.getQuota();
      if (quota) {
        console.log(chalk.dim('Quota:'));
        console.log(chalk.dim(`  Scans: ${quota.used || 0}/${quota.limit || 'unlimited'}`));
        console.log();
      }
    } catch (e) {
      // Quota fetch failed, ignore
    }

    console.log(chalk.dim(`Config: ${getConfigPath()}\n`));
  } catch (error) {
    spinner.fail('Failed to fetch user info');
    outputError(error.message);

    // Token might be invalid
    console.log(chalk.dim('\nTry logging in again with'), brand.cyan('controlinfra login\n'));
  }
}

/**
 * Show dashboard after login
 */
async function showDashboard(user) {
  gradientBanner();

  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'there';
  console.log(`\n  ${brand.cyan(greeting)}, ${chalk.bold(userName)}!`);
  console.log(chalk.dim('  Welcome to Controlinfra CLI\n'));

  // Fetch stats
  const spinner = createSpinner('Loading your dashboard...').start();

  try {
    const [repoData, scanData, driftData] = await Promise.all([
      api.repos.list().catch(() => ({ configs: [] })),
      api.scans.list({ limit: 100 }).catch(() => ({ scans: [] })),
      api.drifts.list({ status: 'detected', limit: 100 }).catch(() => ({ drifts: [] })),
    ]);

    spinner.stop();

    const repoList = repoData?.configs || repoData?.repositories || [];
    const scanList = scanData?.scans || [];
    const driftList = driftData?.drifts || [];

    // Stats
    console.log('  ' + chalk.dim('─'.repeat(56)));
    const stats = [
      `${chalk.dim('Repositories')}: ${brand.cyanBold(repoList.length)}`,
      `${chalk.dim('Active Drifts')}: ${driftList.length > 0 ? chalk.yellow.bold(driftList.length) : chalk.green.bold(0)}`,
      `${chalk.dim('Total Scans')}: ${chalk.blue.bold(scanList.length)}`,
    ];
    console.log(`  ${stats.join('   ')}`);
    console.log('  ' + chalk.dim('─'.repeat(56)));
    console.log();

    // Quick actions
    console.log(`  ${brand.purpleBold('Quick Actions:')}`);
    if (repoList.length === 0) {
      console.log(`    ${chalk.yellow('controlinfra repos add <owner/repo>')}  ${chalk.dim('Add your first repository')}`);
    } else {
      console.log(`    ${chalk.yellow('controlinfra scan run <repo>')}         ${chalk.dim('Run a drift scan')}`);
    }
    if (driftList.length > 0) {
      console.log(`    ${chalk.yellow('controlinfra drifts list')}             ${chalk.dim('View active drifts')}`);
    }
    console.log(`    ${chalk.yellow('controlinfra --help')}                  ${chalk.dim('View all commands')}`);
    console.log();
    console.log(`  ${chalk.dim('Documentation:')} ${brand.cyan('https://docs.controlinfra.com')}`);
    console.log();
  } catch (_error) {
    spinner.stop();
    // Show basic message on error
    console.log(`\n  ${brand.purpleBold('Get started:')}`);
    console.log(`    ${chalk.yellow('controlinfra --help')}  ${chalk.dim('View all available commands')}`);
    console.log();
  }
}

module.exports = {
  login,
  logout,
  whoami,
};
