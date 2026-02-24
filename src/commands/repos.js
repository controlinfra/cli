const chalk = require('chalk');
const { repos } = require('../api');
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

/**
 * List configured repositories
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching repositories...').start();

  try {
    const data = await repos.list({ workspace: options.workspace });
    const repoList = data.configs || data.repositories || data || [];
    spinner.stop();

    const isJson = command?.parent?.parent?.opts()?.json;
    if (isJson) {
      console.log(JSON.stringify(repoList, null, 2));
      return;
    }

    if (repoList.length === 0) {
      console.log(chalk.yellow('\nNo repositories configured\n'));
      console.log(chalk.dim('Add a repository with'), brand.cyan('controlinfra repos add <owner/repo>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Repository', 'Branch', 'Status', 'Last Scan'],
      repoList.map((repo) => [
        chalk.dim(repo._id?.slice(-8) || '-'),
        brand.cyan(repo.repository?.fullName || repo.fullName || '-'),
        repo.branch || 'main',
        colorStatus(repo.lastScanStatus || 'pending'),
        formatRelativeTime(repo.lastScanAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch repositories');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Resolve a partial ID to a full ID by matching against existing repos
 */
async function resolveRepoId(partialId) {
  const data = await repos.list({});
  const repoList = data.configs || data.repositories || data || [];

  const exactMatch = repoList.find((r) => r._id === partialId);
  if (exactMatch) return exactMatch._id;

  const partialMatch = repoList.find((r) => r._id?.endsWith(partialId));
  if (partialMatch) return partialMatch._id;

  const nameMatch = repoList.find(
    (r) => (r.repository?.fullName || r.fullName || '')
      .toLowerCase()
      .includes(partialId.toLowerCase()),
  );
  if (nameMatch) return nameMatch._id;

  return null;
}

/**
 * Remove a repository
 */
async function remove(id, options) {
  requireAuth();

  if (!options.force) {
    const inquirer = require('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to remove this repository? This will delete all scan history.',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Removing repository...').start();

  try {
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    await repos.delete(fullId);
    spinner.succeed('Repository removed successfully');
  } catch (error) {
    spinner.fail('Failed to remove repository');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show repository details
 */
async function info(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching repository info...').start();

  try {
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    const data = await repos.get(fullId);
    const repo = data.repository || data.config || data;
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(repo, null, 2));
      return;
    }

    console.log();
    outputBox('Repository Details', [
      `Name:         ${brand.cyan(repo.repository?.fullName || '-')}`,
      `Branch:       ${repo.repository?.defaultBranch || repo.branch || 'main'}`,
      `Terraform:    ${repo.terraformConfig?.directory || repo.terraformDir || '.'}`,
      `Schedule:     ${repo.scanConfig?.schedule || repo.schedule || 'manual'}`,
      `Status:       ${colorStatus(repo.lastScan?.status || repo.lastScanStatus || 'pending')}`,
      `Last Scan:    ${formatRelativeTime(repo.lastScan?.completedAt || repo.lastScanAt)}`,
      `Created:      ${formatRelativeTime(repo.createdAt)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch repository info');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show repository statistics
 */
async function stats(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching statistics...').start();

  try {
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    const data = await repos.getStats(fullId);
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    outputBox('Repository Statistics', [
      `Total Scans:      ${data.totalScans || 0}`,
      `Successful:       ${chalk.green(data.successfulScans || 0)}`,
      `Failed:           ${chalk.red(data.failedScans || 0)}`,
      `Total Drifts:     ${data.totalDrifts || 0}`,
      `Open Drifts:      ${chalk.yellow(data.openDrifts || 0)}`,
      `Resolved:         ${chalk.green(data.resolvedDrifts || 0)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch statistics');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  list,
  resolveRepoId,
  remove,
  info,
  stats,
};
