const chalk = require('chalk');
const { runners } = require('../api');
const { requireAuth, getApiUrl } = require('../config');
const { createSpinner, outputError, brand } = require('../output');

/**
 * Resolve a partial ID to a full ID by matching against existing runners
 */
async function resolveRunnerId(partialId) {
  const data = await runners.list();
  const runnerList = data.runners || data || [];

  const exactMatch = runnerList.find((r) => (r.id || r._id) === partialId);
  if (exactMatch) return exactMatch.id || exactMatch._id;

  const partialMatch = runnerList.find((r) => (r.id || r._id)?.endsWith(partialId));
  if (partialMatch) return partialMatch.id || partialMatch._id;

  const nameMatch = runnerList.find(
    (r) => r.name?.toLowerCase().includes(partialId.toLowerCase()),
  );
  if (nameMatch) return nameMatch.id || nameMatch._id;

  return null;
}

/**
 * Get runner installation script
 */
async function setup(runnerId, options) {
  requireAuth();

  const spinner = createSpinner('Generating setup script...').start();

  try {
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    const tokenData = await runners.regenerateToken(fullId);
    const token = tokenData.token;

    if (!token) {
      spinner.fail('Failed to generate setup token');
      outputError('Could not retrieve runner token. Please try again.');
      process.exit(1);
    }

    const data = await runners.getSetup(fullId);
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify({ ...data, token }, null, 2));
      return;
    }

    const apiUrl = getApiUrl();
    const os = options.os || 'linux';

    console.log(chalk.bold('\n  Runner Setup\n'));
    console.log(chalk.dim('─'.repeat(60)));

    if (os === 'linux' || os === 'macos') {
      console.log(brand.purpleBold('\nInstallation Script (Linux/macOS):\n'));
      console.log(chalk.dim('# Download and run the installation script (run as root/sudo)'));
      console.log(`curl -sL "${apiUrl}/api/runners/${fullId}/setup?token=${token}" | sudo bash`);
      console.log();
      console.log(chalk.dim('# Or using Docker:'));
      console.log('docker run -d \\');
      console.log('  --name controlinfra-runner \\');
      console.log(`  -e RUNNER_TOKEN="${token}" \\`);
      console.log(`  -e API_URL="${apiUrl}" \\`);
      console.log('  -v /var/run/docker.sock:/var/run/docker.sock \\');
      console.log('  controlinfra/runner:latest');
    } else if (os === 'windows') {
      console.log(brand.purpleBold('\nInstallation Script (Windows PowerShell):\n'));
      console.log(chalk.dim('# Note: Windows support is experimental'));
      console.log(`$env:RUNNER_TOKEN="${token}"`);
      console.log(`$env:API_URL="${apiUrl}"`);
      console.log(`Invoke-WebRequest -Uri "${apiUrl}/api/runners/${fullId}/setup?token=${token}" -UseBasicParsing | Invoke-Expression`);
    }

    console.log();
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.yellow('\n  A new token was generated. Any previously installed runner'));
    console.log(chalk.yellow('   using the old token will need to be reinstalled.\n'));
    console.log(chalk.dim('Keep the token secure - it provides access to your account.\n'));
  } catch (error) {
    spinner.fail('Failed to get setup script');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { setup, resolveRunnerId };
