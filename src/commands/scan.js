const chalk = require('chalk');
const { scans, repos } = require('../api');
const { requireAuth, getDriftGateDefaults } = require('../config');
const {
  brand,
  createSpinner,
  outputTable,
  outputError,
  colorStatus,
  formatRelativeTime,
  formatDuration,
  truncate,
} = require('../output');
const { waitForScan, resolveScanId, getGlobalJsonFlag } = require('./scan-wait');

/**
 * Trigger a new scan
 */
async function run(repository, options, command) {
  requireAuth();

  const spinner = createSpinner(`Starting scan for ${repository}...`).start();

  try {
    const repoList = await repos.list();
    const repoConfigs = repoList.configs || repoList.repositories || repoList.data || repoList || [];
    const configsArray = Array.isArray(repoConfigs) ? repoConfigs : [];

    let matchingConfigs = configsArray.filter(
      (r) =>
        r.repository?.fullName === repository ||
        r._id === repository ||
        r._id?.endsWith(repository),
    );

    if (options.directory && matchingConfigs.length > 0) {
      const dirFilter = options.directory.replace(/^\/+|\/+$/g, '');
      matchingConfigs = matchingConfigs.filter((r) => {
        const configDir = (r.terraformConfig?.directory || '.').replace(/^\/+|\/+$/g, '');
        return configDir === dirFilter || configDir.includes(dirFilter) || dirFilter.includes(configDir);
      });
    }

    const repoConfig = matchingConfigs[0];

    if (!repoConfig) {
      spinner.fail(`Repository "${repository}"${options.directory ? ` with directory "${options.directory}"` : ''} not found`);
      console.log(chalk.dim('\nMake sure the repository is configured. Run:'));
      console.log(brand.cyan(`  controlinfra repos add ${repository}\n`));
      if (matchingConfigs.length === 0 && configsArray.some(r => r.repository?.fullName === repository)) {
        console.log(chalk.dim('Available directories for this repo:'));
        configsArray
          .filter(r => r.repository?.fullName === repository)
          .forEach(r => console.log(brand.cyan(`  - ${r.terraformConfig?.directory || '.'}`)));
        console.log();
      }
      process.exit(1);
    }

    if (matchingConfigs.length > 1 && !options.directory) {
      spinner.warn(`Multiple workspaces found for "${repository}". Using: ${repoConfig.terraformConfig?.directory || '.'}`);
      console.log(chalk.dim('Specify a directory with --directory or -d option:'));
      matchingConfigs.forEach(r => console.log(brand.cyan(`  controlinfra scan run ${repository} -d ${r.terraformConfig?.directory || '.'}`)));
      console.log();
    }

    const scanData = await scans.trigger(repoConfig._id, {
      runnerId: options.runner,
    });

    const scanId = scanData.scanId || scanData.scan?._id || scanData._id;
    spinner.succeed(`Scan started: ${brand.cyan(scanId)}`);

    if (options.wait) {
      const isJson = getGlobalJsonFlag(command);
      const envDefaults = getDriftGateDefaults();

      console.log();
      await waitForScan(scanId, {
        timeout: options.timeout,
        failOnDrift: options.failOnDrift || envDefaults.failOnDrift,
        failOnSeverity: options.failOnSeverity || envDefaults.failOnSeverity,
        failOnNewOnly: options.failOnNewOnly || envDefaults.failOnNewOnly,
        json: isJson,
      });
    } else {
      console.log(chalk.dim(`\nCheck status with: controlinfra scan status ${scanId}\n`));
    }

    if (getGlobalJsonFlag(command)) {
      console.log(JSON.stringify(scanData, null, 2));
    }
  } catch (error) {
    spinner.fail('Failed to start scan');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * List scans
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching scans...').start();

  try {
    let data;
    if (options.repo) {
      data = await scans.getByRepository(options.repo, {
        limit: options.limit,
        status: options.status,
      });
    } else {
      data = await scans.list({
        limit: options.limit,
        status: options.status,
      });
    }

    const scanList = data.scans || data || [];
    spinner.stop();

    const isJson = getGlobalJsonFlag(command);
    if (isJson) {
      console.log(JSON.stringify(scanList, null, 2));
      return;
    }

    if (scanList.length === 0) {
      console.log(chalk.yellow('\nNo scans found\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Repository', 'Status', 'Drifts', 'Duration', 'Started'],
      scanList.map((scan) => [
        chalk.dim(scan._id?.slice(-8) || '-'),
        truncate(scan.repositoryConfigId?.repository?.fullName || '-', 30),
        colorStatus(scan.status),
        scan.driftResults?.totalDrifts || '-',
        formatDuration(scan.timing?.totalDuration),
        formatRelativeTime(scan.timing?.startedAt || scan.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch scans');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Cancel a running scan
 */
async function cancel(scanId, _options) {
  requireAuth();

  const spinner = createSpinner('Cancelling scan...').start();

  try {
    const fullId = await resolveScanId(scanId);
    if (!fullId) {
      spinner.fail('Scan not found');
      outputError(`No scan found matching "${scanId}"`);
      process.exit(1);
    }

    await scans.cancel(fullId);
    spinner.succeed('Scan cancelled');
  } catch (error) {
    spinner.fail('Failed to cancel scan');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show scan logs
 */
async function logs(scanId, options) {
  requireAuth();

  const spinner = createSpinner('Fetching scan logs...').start();

  try {
    const fullId = await resolveScanId(scanId);
    if (!fullId) {
      spinner.fail('Scan not found');
      outputError(`No scan found matching "${scanId}"`);
      process.exit(1);
    }

    const data = await scans.getDetails(fullId);
    const scan = data.scan || data;
    spinner.stop();

    if (getGlobalJsonFlag(options)) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }

    console.log(chalk.bold('\n  Scan Logs\n'));
    console.log(chalk.dim('─'.repeat(60)));

    if (scan.timing) {
      console.log(brand.purpleBold('\nTiming:'));
      console.log(`  Clone:      ${formatDuration(scan.timing.cloneDuration)}`);
      console.log(`  Init:       ${formatDuration(scan.timing.initDuration)}`);
      console.log(`  Plan:       ${formatDuration(scan.timing.planDuration)}`);
      console.log(`  Analysis:   ${formatDuration(scan.timing.analysisDuration)}`);
      console.log(`  Total:      ${formatDuration(scan.timing.totalDuration)}`);
    }

    if (scan.status === 'failed' && scan.error) {
      console.log(chalk.red('\nError:'));
      console.log(`  ${scan.error}`);
    }

    if (scan.planOutput) {
      console.log(brand.purpleBold('\nPlan Output:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(scan.planOutput);
    }

    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch scan logs');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  run,
  list,
  cancel,
  logs,
};
