const chalk = require('chalk');
const http = require('http');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const api = require('../api');
const { auth } = api;
const { saveAuth, clearAuth, getUser, isAuthenticated, getApiUrl, getConfigPath } = require('../config');
const { createSpinner, outputError, outputInfo, outputBox } = require('../output');

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
    console.log(chalk.yellow('\n  Automatic auth failed. Falling back to manual mode.\n'));
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
      console.log(chalk.cyan(`  ${authUrl}\n`));

      // Open browser using platform-native commands
      try {
        const platform = process.platform;
        if (platform === 'darwin') execSync(`open "${authUrl}"`);
        else if (platform === 'win32') execSync(`start "" "${authUrl}"`);
        else execSync(`xdg-open "${authUrl}"`);
      } catch (_e) {
        // Browser open failed silently — URL is printed above
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
            // Send error response
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getErrorHtml(error));
            server.close();
            reject(new Error(error));
            return;
          }

          if (token) {
            // Send success response
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getSuccessHtml());
            server.close();
            resolve({ token });
            return;
          }

          // No token received
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
  const authUrl = `${apiUrl}/api/auth/github?cli=true`;

  console.log(chalk.dim('  Visit this URL to authenticate:'));
  console.log(chalk.cyan(`  ${authUrl}\n`));

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Paste the token from the browser:',
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
 * Success HTML page shown in browser after auth
 */
function getSuccessHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Controlinfra - Login Successful</title>
  <link rel="icon" href="https://d11ycnukdvjoh1.cloudfront.net/icons/favicon.svg">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      max-width: 400px;
      width: 90%;
    }
    .logo {
      width: 48px;
      height: 48px;
      margin-bottom: 1.5rem;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .success-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h1 {
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.938rem;
      line-height: 1.5;
    }
    .terminal-hint {
      margin-top: 1.5rem;
      padding: 0.75rem 1rem;
      background: #f1f5f9;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.813rem;
      color: #475569;
    }
    .close-hint {
      margin-top: 1.5rem;
      font-size: 0.813rem;
      color: #94a3b8;
    }
    .brand {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.813rem;
    }
    .brand svg {
      width: 20px;
      height: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1>Authentication Successful</h1>
    <p>You've been logged in to Controlinfra CLI.</p>
    <div class="terminal-hint">Return to your terminal to continue</div>
    <p class="close-hint">This window will close automatically...</p>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      Controlinfra
    </div>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;
}

/**
 * Error HTML page shown in browser on auth failure
 */
function getErrorHtml(error) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Controlinfra - Login Failed</title>
  <link rel="icon" href="https://d11ycnukdvjoh1.cloudfront.net/icons/favicon.svg">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      max-width: 400px;
      width: 90%;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .error-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h1 {
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.938rem;
      line-height: 1.5;
    }
    .error-message {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 0.813rem;
      color: #b91c1c;
    }
    .retry-hint {
      margin-top: 1.5rem;
      font-size: 0.813rem;
      color: #94a3b8;
    }
    .retry-hint code {
      background: #f1f5f9;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      color: #475569;
    }
    .brand {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.813rem;
    }
    .brand svg {
      width: 20px;
      height: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </div>
    <h1>Authentication Failed</h1>
    <p>We couldn't complete your login.</p>
    <div class="error-message">${error}</div>
    <p class="retry-hint">Run <code>controlinfra login</code> to try again</p>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      Controlinfra
    </div>
  </div>
</body>
</html>`;
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
    console.log(chalk.dim('Run'), chalk.cyan('controlinfra login'), chalk.dim('to authenticate\n'));
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
      `Name:    ${chalk.cyan(user.displayName || '-')}`,
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
    console.log(chalk.dim('\nTry logging in again with'), chalk.cyan('controlinfra login\n'));
  }
}

/**
 * Show dashboard after login
 */
async function showDashboard(user) {
  console.log();

  // ASCII Banner
  const banner = `
   ____            _             _ _        __
  / ___|___  _ __ | |_ _ __ ___ | (_)_ __  / _|_ __ __ _
 | |   / _ \\| '_ \\| __| '__/ _ \\| | | '_ \\| |_| '__/ _\` |
 | |__| (_) | | | | |_| | | (_) | | | | | |  _| | | (_| |
  \\____\\___/|_| |_|\\__|_|  \\___/|_|_|_| |_|_| |_|  \\__,_|
`;

  const lines = banner.split('\n');
  const colors = [
    chalk.hex('#ac9fe0'),
    chalk.hex('#b5a8e3'),
    chalk.hex('#bdb1e6'),
    chalk.hex('#c5bae9'),
    chalk.hex('#cdc3ec'),
    chalk.hex('#bdedfa'),
  ];

  lines.forEach((line, i) => {
    if (line.trim()) {
      const colorIndex = Math.min(i, colors.length - 1);
      console.log(colors[colorIndex](line));
    }
  });

  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'there';
  console.log(`\n  ${chalk.cyan(greeting)}, ${chalk.bold(userName)}!`);
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
      `${chalk.dim('Repositories')}: ${chalk.cyan.bold(repoList.length)}`,
      `${chalk.dim('Active Drifts')}: ${driftList.length > 0 ? chalk.yellow.bold(driftList.length) : chalk.green.bold(0)}`,
      `${chalk.dim('Total Scans')}: ${chalk.blue.bold(scanList.length)}`,
    ];
    console.log(`  ${stats.join('   ')}`);
    console.log('  ' + chalk.dim('─'.repeat(56)));
    console.log();

    // Quick actions
    console.log(`  ${chalk.cyan('Quick Actions:')}`);
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
    console.log(`  ${chalk.dim('Documentation:')} ${chalk.cyan('https://docs.controlinfra.com')}`);
    console.log();
  } catch (_error) {
    spinner.stop();
    // Show basic message on error
    console.log(`\n  ${chalk.cyan('Get started:')}`);
    console.log(`    ${chalk.yellow('controlinfra --help')}  ${chalk.dim('View all available commands')}`);
    console.log();
  }
}

module.exports = {
  login,
  logout,
  whoami,
};
