const chalk = require('chalk');
const inquirer = require('inquirer');
const { runners } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  colorStatus,
  brand,
  formatRelativeTime,
} = require('../output');
const { resolveRunnerId } = require('./runners-setup');

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
      console.log(chalk.dim('Create a runner with'), brand.cyan('controlinfra runners add <name>\n'));
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
        brand.cyan(runner.name || '-'),
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
async function add(name, options) {
  requireAuth();

  const runnerName = name || 'my-runner';
  const spinner = createSpinner('Creating runner...').start();

  try {
    const data = await runners.create({
      name: runnerName,
      labels: options.labels ? options.labels.split(',').map((l) => l.trim()) : [],
    });

    const runner = data.runner || data;
    spinner.succeed(`Runner "${brand.cyan(runner.name)}" created`);

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(runner, null, 2));
      return;
    }

    const runnerId = runner.id || runner._id;
    console.log();
    outputBox('Runner Created', [
      `ID:      ${runnerId}`,
      `Name:    ${brand.cyan(runner.name)}`,
      `Token:   ${chalk.yellow(runner.token || data.token || '[hidden]')}`,
    ].join('\n'));
    console.log();

    console.log(brand.purpleBold('Setup Instructions:'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log('\n1. Get the installation script:');
    console.log(brand.cyan(`   controlinfra runners setup ${runnerId}\n`));
    console.log('2. Or manually install the runner agent on your server');
    console.log();
  } catch (error) {
    spinner.fail('Failed to create runner');
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
      `Name:        ${brand.cyan(runner.name)}`,
      `Status:      ${colorStatus(runner.status || 'offline')}`,
      `Labels:      ${(runner.labels || []).join(', ') || '-'}`,
      `Version:     ${runner.version || '-'}`,
      `Last Seen:   ${formatRelativeTime(runner.lastHeartbeat)}`,
      `Created:     ${formatRelativeTime(runner.createdAt)}`,
    ].join('\n'));
    console.log();

    if (runner.recentJobs && runner.recentJobs.length > 0) {
      console.log(brand.purpleBold('Recent Jobs:'));
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
    console.log(brand.purpleBold('New Token:'), chalk.yellow(data.token));
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
  status,
  remove,
  regenerateToken,
};
