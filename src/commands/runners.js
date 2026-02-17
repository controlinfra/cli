const chalk = require('chalk');
const inquirer = require('inquirer');
const { runners } = require('../api');
const { requireAuth, getApiUrl } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  colorStatus,
  formatRelativeTime,
} = require('../output');

/**
 * List all runners
 */
async function list(options) {
  requireAuth();

  const spinner = createSpinner('Fetching runners...').start();

  try {
    const data = await runners.list();
    const runnerList = data.runners || data || [];
    spinner.stop();

    if (runnerList.length === 0) {
      console.log(chalk.yellow('\nNo runners configured\n'));
      console.log(chalk.dim('Create a runner with'), chalk.cyan('controlinfra runners add --name <name>\n'));
      return;
    }

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(runnerList, null, 2));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Name', 'Status', 'Labels', 'Last Seen'],
      runnerList.map((runner) => [
        chalk.dim((runner.id || runner._id)?.slice(-8) || '-'),
        chalk.cyan(runner.name || '-'),
        colorStatus(runner.status || 'offline'),
        (runner.labels || []).join(', ') || '-',
        formatRelativeTime(runner.lastHeartbeat),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch runners');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create a new runner
 */
async function add(options) {
  requireAuth();

  const spinner = createSpinner('Creating runner...').start();

  try {
    const data = await runners.create({
      name: options.name,
      labels: options.labels ? options.labels.split(',').map((l) => l.trim()) : [],
    });

    const runner = data.runner || data;
    spinner.succeed(`Runner "${chalk.cyan(runner.name)}" created`);

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(runner, null, 2));
      return;
    }

    const runnerId = runner.id || runner._id;
    console.log();
    outputBox('Runner Created', [
      `ID:      ${runnerId}`,
      `Name:    ${chalk.cyan(runner.name)}`,
      `Token:   ${chalk.yellow(runner.token || data.token || '[hidden]')}`,
    ].join('\n'));
    console.log();

    console.log(chalk.cyan('Setup Instructions:'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log('\n1. Get the installation script:');
    console.log(chalk.cyan(`   controlinfra runners setup ${runnerId}\n`));
    console.log('2. Or manually install the runner agent on your server');
    console.log();
  } catch (error) {
    spinner.fail('Failed to create runner');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Resolve a partial ID to a full ID by matching against existing runners
 */
async function resolveRunnerId(partialId) {
  const data = await runners.list();
  const runnerList = data.runners || data || [];

  // Try exact match first
  const exactMatch = runnerList.find((r) => (r.id || r._id) === partialId);
  if (exactMatch) return exactMatch.id || exactMatch._id;

  // Try partial match (ID ends with the partial)
  const partialMatch = runnerList.find((r) => (r.id || r._id)?.endsWith(partialId));
  if (partialMatch) return partialMatch.id || partialMatch._id;

  // Try matching by name
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
    // Resolve partial ID to full ID
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    // Regenerate token to get a fresh one (tokens are hashed in DB and can't be retrieved)
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

    console.log(chalk.bold('\n  Runner Setup\n'));
    console.log(chalk.dim('─'.repeat(60)));

    // Generate installation script based on OS
    const os = options.os || 'linux';
    // fullId is already resolved above via resolveRunnerId()

    if (os === 'linux' || os === 'macos') {
      console.log(chalk.cyan('\nInstallation Script (Linux/macOS):\n'));
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
      console.log(chalk.cyan('\nInstallation Script (Windows PowerShell):\n'));
      console.log(chalk.dim('# Note: Windows support is experimental'));
      console.log(`$env:RUNNER_TOKEN="${token}"`);
      console.log(`$env:API_URL="${apiUrl}"`);
      console.log(`Invoke-WebRequest -Uri "${apiUrl}/api/runners/${fullId}/setup?token=${token}" -UseBasicParsing | Invoke-Expression`);
    }

    console.log();
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.yellow('\n⚠️  A new token was generated. Any previously installed runner'));
    console.log(chalk.yellow('   using the old token will need to be reinstalled.\n'));
    console.log(chalk.dim('Keep the token secure - it provides access to your account.\n'));
  } catch (error) {
    spinner.fail('Failed to get setup script');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Check runner status
 */
async function status(runnerId, options) {
  requireAuth();

  const spinner = createSpinner('Fetching runner status...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    const data = await runners.get(fullId);
    const runner = data.runner || data;
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(runner, null, 2));
      return;
    }

    console.log();
    outputBox('Runner Status', [
      `ID:          ${chalk.dim(runner.id || runner._id)}`,
      `Name:        ${chalk.cyan(runner.name)}`,
      `Status:      ${colorStatus(runner.status || 'offline')}`,
      `Labels:      ${(runner.labels || []).join(', ') || '-'}`,
      `Version:     ${runner.version || '-'}`,
      `Last Seen:   ${formatRelativeTime(runner.lastHeartbeat)}`,
      `Created:     ${formatRelativeTime(runner.createdAt)}`,
    ].join('\n'));
    console.log();

    // Show recent jobs if available
    if (runner.recentJobs && runner.recentJobs.length > 0) {
      console.log(chalk.cyan('Recent Jobs:'));
      runner.recentJobs.slice(0, 5).forEach((job) => {
        console.log(`  ${colorStatus(job.status)} ${job.repository || '-'} (${formatRelativeTime(job.completedAt)})`);
      });
      console.log();
    }
  } catch (error) {
    spinner.fail('Failed to fetch runner status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove a runner
 */
async function remove(runnerId, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this runner?',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Deleting runner...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    await runners.delete(fullId);
    spinner.succeed('Runner deleted successfully');
  } catch (error) {
    spinner.fail('Failed to delete runner');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Regenerate runner token
 */
async function regenerateToken(runnerId, options) {
  requireAuth();

  const spinner = createSpinner('Regenerating token...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    const data = await runners.regenerateToken(fullId);
    spinner.succeed('Token regenerated');

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    console.log(chalk.cyan('New Token:'), chalk.yellow(data.token));
    console.log();
    console.log(chalk.yellow('Update your runner configuration with this new token.'));
    console.log(chalk.dim('The old token is now invalid.\n'));
  } catch (error) {
    spinner.fail('Failed to regenerate token');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  list,
  add,
  setup,
  status,
  remove,
  regenerateToken,
};
