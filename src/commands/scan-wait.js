const chalk = require('chalk');
const { scans, drifts } = require('../api');
const { requireAuth, getDriftGateDefaults } = require('../config');
const {
  brand,
  createSpinner,
  outputError,
  outputBox,
  colorStatus,
  formatRelativeTime,
  formatDuration,
} = require('../output');
const { evaluateDriftGate, outputDriftTable } = require('./scan-output');

/**
 * Get global JSON output flag from command hierarchy
 */
function getGlobalJsonFlag(command) {
  let current = command;
  while (current) {
    const opts = current.opts?.();
    if (opts?.json !== undefined) {
      return opts.json;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Resolve a partial scan ID to a full ID
 */
async function resolveScanId(partialId) {
  if (/^[a-f0-9]{24}$/i.test(partialId)) {
    return partialId;
  }

  const data = await scans.list({ limit: 100 });
  const scanList = data.scans || data || [];

  const exactMatch = scanList.find((s) => s._id === partialId);
  if (exactMatch) return exactMatch._id;

  const partialMatch = scanList.find((s) => s._id?.endsWith(partialId));
  if (partialMatch) return partialMatch._id;

  return null;
}

/**
 * Check scan status
 */
async function status(scanId, options) {
  requireAuth();

  const spinner = createSpinner('Fetching scan status...').start();

  try {
    const fullId = await resolveScanId(scanId);
    if (!fullId) {
      spinner.fail('Scan not found');
      outputError(`No scan found matching "${scanId}"`);
      process.exit(1);
    }

    const data = await scans.get(fullId);
    const scan = data.scan || data.data || data;
    spinner.stop();

    if (getGlobalJsonFlag(options)) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }

    const isRunning = ['running', 'queued', 'cloning', 'initializing', 'planning', 'analyzing'].includes(scan.status);

    console.log();
    outputBox('Scan Status', [
      `ID:          ${chalk.dim(scan._id)}`,
      `Repository:  ${brand.cyan(scan.repositoryConfigId?.repository?.fullName || '-')}`,
      `Status:      ${colorStatus(scan.status)}`,
      `Started:     ${formatRelativeTime(scan.timing?.startedAt || scan.createdAt)}`,
      `Duration:    ${formatDuration(scan.timing?.totalDuration)}`,
      `Drifts:      ${scan.driftResults?.totalDrifts || 0}`,
    ].join('\n'));
    console.log();

    if (isRunning) {
      console.log(chalk.dim('Scan is still running. Wait with:'));
      console.log(brand.cyan(`  controlinfra scan wait ${scanId}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to fetch scan status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Wait for scan to complete
 */
async function wait(scanId, options, command) {
  requireAuth();

  const fullId = await resolveScanId(scanId);
  if (!fullId) {
    outputError(`No scan found matching "${scanId}"`);
    process.exit(1);
  }

  const envDefaults = getDriftGateDefaults();
  const isJson = getGlobalJsonFlag(command);

  await waitForScan(fullId, {
    ...options,
    failOnDrift: options.failOnDrift || envDefaults.failOnDrift,
    failOnSeverity: options.failOnSeverity || envDefaults.failOnSeverity,
    failOnNewOnly: options.failOnNewOnly || envDefaults.failOnNewOnly,
    json: isJson,
  });
}

/**
 * Internal wait function
 */
async function waitForScan(scanId, options = {}) {
  const timeout = parseInt(options.timeout || '600', 10) * 1000;
  const startTime = Date.now();
  const pollInterval = 3000;

  const spinner = createSpinner('Waiting for scan to complete...').start();
  const terminalStatuses = ['completed', 'failed', 'cancelled'];

  try {
    while (Date.now() - startTime < timeout) {
      const data = await scans.get(scanId);
      const scan = data.scan || data.data || data;

      spinner.text = `Scan status: ${scan.status}`;

      if (terminalStatuses.includes(scan.status)) {
        if (scan.status === 'completed') {
          spinner.succeed('Scan completed successfully');
          await handleCompletedScan(scanId, scan, options);
        } else if (scan.status === 'failed') {
          spinner.fail('Scan failed');
          if (scan.error) console.log(chalk.red(`\nError: ${scan.error}\n`));
          process.exit(2);
        } else {
          spinner.warn('Scan was cancelled');
          process.exit(2);
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    spinner.fail('Timeout waiting for scan to complete');
    process.exit(2);
  } catch (error) {
    spinner.fail('Error while waiting for scan');
    outputError(error.message);
    process.exit(2);
  }
}

async function handleCompletedScan(scanId, scan, options) {
  const driftCount = scan.driftResults?.totalDrifts || 0;
  const hasGateOptions = options.failOnDrift || options.failOnSeverity;
  const isJson = options?.json;

  if (driftCount > 0) {
    let driftDetails = [];
    try {
      const driftData = await drifts.getByScan(scanId);
      driftDetails = driftData.drifts || driftData.data || driftData || [];
      if (!Array.isArray(driftDetails)) driftDetails = [];
    } catch (_e) {
      // Continue with summary only
    }

    let gateExitCode = null;
    let gateOptions = null;
    if (hasGateOptions) {
      gateExitCode = evaluateDriftGate(scan, driftDetails, options);
      gateOptions = {
        failOnDrift: options.failOnDrift || false,
        failOnSeverity: options.failOnSeverity || null,
        failOnNewOnly: options.failOnNewOnly || false,
      };
    }

    outputDriftTable(scanId, driftDetails, scan.driftResults, isJson, gateOptions, gateExitCode);

    if (hasGateOptions) {
      if (gateExitCode === 1) {
        if (!isJson) console.log(chalk.red('\n  Drift gate check FAILED - threshold exceeded\n'));
        process.exit(1);
      } else {
        if (!isJson) console.log(chalk.green('\n  Drift gate check PASSED\n'));
      }
    } else if (!isJson) {
      console.log();
      console.log(chalk.dim('View drifts with:'), brand.cyan(`controlinfra drifts list --scan ${scanId}\n`));
    }
  } else {
    console.log(chalk.green('\nNo drifts detected - infrastructure matches state\n'));
  }
}

module.exports = {
  status,
  wait,
  waitForScan,
  resolveScanId,
  getGlobalJsonFlag,
};
