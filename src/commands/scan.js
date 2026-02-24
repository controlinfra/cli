const chalk = require('chalk');
const { scans, repos, drifts } = require('../api');
const { requireAuth } = require('../config');
const {
  brand,
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  colorStatus,
  formatRelativeTime,
  formatDuration,
  truncate,
} = require('../output');
const { getApiUrl, getDriftGateDefaults } = require('../config');

/**
 * Get global JSON output flag from command hierarchy
 * Centralizes the logic for accessing global --json option
 * @param {object} command - Commander command object
 * @returns {boolean} Whether JSON output is requested
 */
function getGlobalJsonFlag(command) {
  // Try to get global --json option by traversing up the command hierarchy
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
 * Evaluate drift gate conditions and return exit code
 * @param {object} scan - Scan object with driftResults
 * @param {array} driftDetails - Array of drift objects from API
 * @param {object} options - Gate options (failOnDrift, failOnSeverity, failOnNewOnly)
 * @returns {number} Exit code: 0 = pass (no drifts, below threshold, or no gate conditions configured), 1 = fail (threshold exceeded)
 */
function evaluateDriftGate(scan, driftDetails, options) {
  const driftResults = scan.driftResults || {};

  // No drifts = always pass
  if (!driftResults.hasDrift || driftResults.totalDrifts === 0) {
    return 0;
  }

  // Filter to new drifts only if --fail-on-new-only
  const relevantDrifts = options.failOnNewOnly
    ? driftDetails.filter((d) => d.isNew === true)
    : driftDetails;

  if (relevantDrifts.length === 0) {
    return 0;
  }

  // --fail-on-drift without --fail-on-severity: any drift fails
  if (options.failOnDrift && !options.failOnSeverity) {
    return 1;
  }

  // --fail-on-severity: check severity threshold
  if (options.failOnSeverity) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const threshold = severityOrder[options.failOnSeverity.toLowerCase()];

    if (!threshold) {
      // Invalid severity provided, inform user and treat as fail
      outputError(
        `Invalid severity level "${options.failOnSeverity}". Valid values are: critical, high, medium, low.`,
      );
      return 1;
    }

    const hasExceedingDrift = relevantDrifts.some((drift) => {
      const driftSeverity = severityOrder[drift.severity?.toLowerCase()] || 0;
      return driftSeverity >= threshold;
    });

    return hasExceedingDrift ? 1 : 0;
  }

  return 0;
}

/**
 * Output drift table with summary and console link
 * @param {string} scanId - Scan ID
 * @param {array} driftDetails - Array of drift objects
 * @param {object} driftResults - Aggregated drift results from scan
 * @param {boolean} isJson - Output as JSON
 * @param {object} gateOptions - Gate options for JSON output (optional)
 * @param {number} gateExitCode - Gate evaluation result (optional)
 */
function outputDriftTable(scanId, driftDetails, driftResults, isJson, gateOptions = null, gateExitCode = null) {
  // Construct console URL - always use the main controlinfra.com domain
  const apiUrl = getApiUrl();
  let consoleUrl;
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    // Local development
    consoleUrl = `http://localhost:5173/scans/${scanId}`;
  } else if (apiUrl.includes('stage')) {
    // Staging environment
    consoleUrl = `https://stage.controlinfra.com/scans/${scanId}`;
  } else {
    // Production
    consoleUrl = `https://controlinfra.com/scans/${scanId}`;
  }

  if (isJson) {
    const output = {
      scanId,
      consoleUrl,
      summary: driftResults,
      drifts: driftDetails,
    };

    // Add gate result if gate options were used
    if (gateOptions !== null && gateExitCode !== null) {
      output.gate = {
        options: gateOptions,
        result: gateExitCode === 0 ? 'passed' : 'failed',
        exitCode: gateExitCode,
      };
    }

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Table output
  console.log();
  console.log(chalk.bold('  Drifts Detected'));
  console.log(chalk.dim('─'.repeat(80)));

  outputTable(
    ['ID', 'Resource', 'Severity', 'Action', 'Status'],
    driftDetails.slice(0, 20).map((drift) => [
      chalk.dim(drift._id?.slice(-8) || '-'),
      truncate(drift.resourceAddress || drift.resource?.address || '-', 40),
      colorStatus(drift.severity || 'unknown'),
      drift.action || drift.change?.action || '-',
      drift.isNew !== false ? chalk.yellow('new') : chalk.dim('recurring'),
    ]),
  );

  if (driftDetails.length > 20) {
    console.log(chalk.dim(`  ... and ${driftDetails.length - 20} more`));
  }

  // Summary line
  const { bySeverity = {} } = driftResults;
  const parts = [];
  if (bySeverity.critical) parts.push(chalk.red(`${bySeverity.critical} critical`));
  if (bySeverity.high) parts.push(chalk.red(`${bySeverity.high} high`));
  if (bySeverity.medium) parts.push(chalk.yellow(`${bySeverity.medium} medium`));
  if (bySeverity.low) parts.push(chalk.dim(`${bySeverity.low} low`));

  console.log();
  console.log(
    `  ${driftResults.totalDrifts || driftDetails.length} drift(s) found` +
      (parts.length ? ` (${parts.join(', ')})` : ''),
  );
  console.log();
  console.log(`  ${chalk.dim('View details:')} ${brand.cyan(consoleUrl)}`);
}

/**
 * Trigger a new scan
 */
async function run(repository, options, command) {
  requireAuth();

  const spinner = createSpinner(`Starting scan for ${repository}...`).start();

  try {
    // Find repository config by name
    const repoList = await repos.list();
    const repoConfigs = repoList.configs || repoList.repositories || repoList.data || repoList || [];

    // Ensure it's an array
    const configsArray = Array.isArray(repoConfigs) ? repoConfigs : [];

    // Filter by repository name, full ID, or partial ID
    let matchingConfigs = configsArray.filter(
      (r) =>
        r.repository?.fullName === repository ||
        r._id === repository ||
        r._id?.endsWith(repository),
    );

    // If --directory is specified, filter by terraform directory
    if (options.directory && matchingConfigs.length > 0) {
      const dirFilter = options.directory.replace(/^\/+|\/+$/g, ''); // Trim slashes
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

    // If multiple configs match and no directory specified, show warning
    if (matchingConfigs.length > 1 && !options.directory) {
      spinner.warn(`Multiple workspaces found for "${repository}". Using: ${repoConfig.terraformConfig?.directory || '.'}`);
      console.log(chalk.dim('Specify a directory with --directory or -d option:'));
      matchingConfigs.forEach(r => console.log(brand.cyan(`  controlinfra scan run ${repository} -d ${r.terraformConfig?.directory || '.'}`)));
      console.log();
    }

    // Trigger scan
    const scanData = await scans.trigger(repoConfig._id, {
      runnerId: options.runner,
    });

    const scanId = scanData.scanId || scanData.scan?._id || scanData._id;
    spinner.succeed(`Scan started: ${brand.cyan(scanId)}`);

    if (options.wait) {
      // Check if JSON output is requested (global flag)
      const isJson = getGlobalJsonFlag(command);

      // Merge environment variable defaults with CLI options (CLI takes precedence)
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

    // Return scan data for JSON output
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
 * Resolve a partial scan ID to a full ID by matching against recent scans
 */
async function resolveScanId(partialId) {
  // If it looks like a full MongoDB ObjectId (24 hex chars), return as-is
  if (/^[a-f0-9]{24}$/i.test(partialId)) {
    return partialId;
  }

  const data = await scans.list({ limit: 100 });
  const scanList = data.scans || data || [];

  // Try exact match first
  const exactMatch = scanList.find((s) => s._id === partialId);
  if (exactMatch) return exactMatch._id;

  // Try partial match (ID ends with the partial)
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
    // Resolve partial ID to full ID
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

  // Resolve partial ID to full ID
  const fullId = await resolveScanId(scanId);
  if (!fullId) {
    outputError(`No scan found matching "${scanId}"`);
    process.exit(1);
  }

  // Merge environment variable defaults with CLI options (CLI takes precedence)
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

      // Update spinner text with current status
      spinner.text = `Scan status: ${scan.status}`;

      if (terminalStatuses.includes(scan.status)) {
        if (scan.status === 'completed') {
          spinner.succeed('Scan completed successfully');

          const driftCount = scan.driftResults?.totalDrifts || 0;
          const hasGateOptions = options.failOnDrift || options.failOnSeverity;

          if (driftCount > 0) {
            // Fetch drift details for table output
            let driftDetails = [];
            try {
              const driftData = await drifts.getByScan(scanId);
              driftDetails = driftData.drifts || driftData.data || driftData || [];
              // Ensure it's an array
              if (!Array.isArray(driftDetails)) {
                driftDetails = [];
              }
            } catch (_e) {
              // If drift fetch fails, continue with summary only
            }

            // Check if JSON output (global flag)
            const isJson = options?.json;

            // Evaluate drift gate if options provided
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

            // Output drift table with console link (and gate info for JSON)
            outputDriftTable(scanId, driftDetails, scan.driftResults, isJson, gateOptions, gateExitCode);

            // Handle exit based on gate result
            if (hasGateOptions) {
              if (gateExitCode === 1) {
                if (!isJson) {
                  console.log(chalk.red('\n  Drift gate check FAILED - threshold exceeded\n'));
                }
                process.exit(1);
              } else {
                if (!isJson) {
                  console.log(chalk.green('\n  Drift gate check PASSED\n'));
                }
              }
            } else if (!isJson) {
              // Original behavior - just show info (only in non-JSON mode)
              console.log();
              console.log(chalk.dim('View drifts with:'), brand.cyan(`controlinfra drifts list --scan ${scanId}\n`));
            }
          } else {
            console.log(chalk.green('\nNo drifts detected - infrastructure matches state\n'));
          }
        } else if (scan.status === 'failed') {
          spinner.fail('Scan failed');
          if (scan.error) {
            console.log(chalk.red(`\nError: ${scan.error}\n`));
          }
          process.exit(2); // Exit code 2 for errors
        } else {
          spinner.warn('Scan was cancelled');
          process.exit(2); // Exit code 2 for errors
        }
        return;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    spinner.fail('Timeout waiting for scan to complete');
    process.exit(2); // Exit code 2 for errors
  } catch (error) {
    spinner.fail('Error while waiting for scan');
    outputError(error.message);
    process.exit(2); // Exit code 2 for errors
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

    // Handle JSON output first (even for empty results)
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
    // Resolve partial ID to full ID
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
    // Resolve partial ID to full ID
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

    // Show timing breakdown
    if (scan.timing) {
      console.log(brand.purpleBold('\nTiming:'));
      console.log(`  Clone:      ${formatDuration(scan.timing.cloneDuration)}`);
      console.log(`  Init:       ${formatDuration(scan.timing.initDuration)}`);
      console.log(`  Plan:       ${formatDuration(scan.timing.planDuration)}`);
      console.log(`  Analysis:   ${formatDuration(scan.timing.analysisDuration)}`);
      console.log(`  Total:      ${formatDuration(scan.timing.totalDuration)}`);
    }

    // Show error if failed
    if (scan.status === 'failed' && scan.error) {
      console.log(chalk.red('\nError:'));
      console.log(`  ${scan.error}`);
    }

    // Show plan output if available
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
  status,
  wait,
  list,
  cancel,
  logs,
};
