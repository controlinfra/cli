const chalk = require('chalk');
const http = require('http');
const { execFile } = require('child_process');
const inquirer = require('inquirer');
const api = require('../api');
const { auth } = api;
const { saveAuth, clearAuth, getUser, isAuthenticated, getApiUrl, getConfigPath } = require('../config');
const { brand, createSpinner, outputError, outputInfo, outputBox } = require('../output');
const { canOpenBrowser } = require('../utils/browser-detect');
const { getSuccessHtml, getErrorHtml } = require('./auth-html');
const { showDashboard } = require('./auth-dashboard');

/**
 * Login to Controlinfra
 */
async function login(options) {
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
    console.log(chalk.yellow('\n  Browser auth unavailable. Falling back to manual mode.\n'));
    await manualTokenEntry();
  }
}

/**
 * Browser auth flow with local callback server
 */
async function browserAuthFlow() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const apiUrl = getApiUrl();
      const authUrl = `${apiUrl}/api/auth/github?cli=true&redirect_uri=${encodeURIComponent(callbackUrl)}`;

      console.log(chalk.dim('  Opening browser for GitHub authentication...\n'));
      console.log(chalk.dim('  If browser does not open, visit:'));
      console.log(brand.cyan(`  ${authUrl}\n`));

      if (process.platform === 'win32') {
        execFile('cmd', ['/c', 'start', '', authUrl.replace(/[&|<>^()]/g, '^$&')]);
      } else {
        execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [authUrl]);
      }

      console.log(chalk.dim('  Waiting for authentication...'));
      console.log(chalk.dim('  Press Ctrl+C to cancel\n'));

      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 120000);

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
 * Manual token entry fallback
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
 * Logout
 */
async function logout() {
  if (!isAuthenticated()) {
    outputInfo('Not currently logged in');
    return;
  }

  const user = getUser();
  const spinner = createSpinner('Logging out...').start();

  try {
    await auth.logout();
  } catch (error) {
    // Ignore - clear local anyway
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
async function whoami(options, command) {
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

    saveAuth({ user });

    if (command?.parent?.opts()?.json) {
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

    try {
      const quota = await auth.getQuota();
      if (quota) {
        console.log(chalk.dim('Quota:'));
        console.log(chalk.dim(`  Scans: ${quota.used || 0}/${quota.limit || 'unlimited'}`));
        console.log();
      }
    } catch (e) {
      // Ignore
    }

    console.log(chalk.dim(`Config: ${getConfigPath()}\n`));
  } catch (error) {
    spinner.fail('Failed to fetch user info');
    outputError(error.message);
    console.log(chalk.dim('\nTry logging in again with'), brand.cyan('controlinfra login\n'));
  }
}

module.exports = {
  login,
  logout,
  whoami,
};
