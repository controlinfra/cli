const chalk = require('chalk');
const { brand, outputTable, outputError, truncate, colorStatus } = require('../output');
const { getApiUrl } = require('../config');

/**
 * Evaluate drift gate conditions and return exit code
 * @returns {number} Exit code: 0 = pass, 1 = fail
 */
function evaluateDriftGate(scan, driftDetails, options) {
  const driftResults = scan.driftResults || {};

  if (!driftResults.hasDrift || driftResults.totalDrifts === 0) {
    return 0;
  }

  const relevantDrifts = options.failOnNewOnly
    ? driftDetails.filter((d) => d.isNew === true)
    : driftDetails;

  if (relevantDrifts.length === 0) {
    return 0;
  }

  if (options.failOnDrift && !options.failOnSeverity) {
    return 1;
  }

  if (options.failOnSeverity) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const threshold = severityOrder[options.failOnSeverity.toLowerCase()];

    if (!threshold) {
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
 * Get console URL for a scan
 */
function getConsoleUrl(scanId) {
  const apiUrl = getApiUrl();
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    return `http://localhost:5173/scans/${scanId}`;
  } else if (apiUrl.includes('stage')) {
    return `https://stage.controlinfra.com/scans/${scanId}`;
  }
  return `https://controlinfra.com/scans/${scanId}`;
}

/**
 * Output drift table with summary and console link
 */
function outputDriftTable(scanId, driftDetails, driftResults, isJson, gateOptions = null, gateExitCode = null) {
  const consoleUrl = getConsoleUrl(scanId);

  if (isJson) {
    const output = {
      scanId,
      consoleUrl,
      summary: driftResults,
      drifts: driftDetails,
    };

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

module.exports = { evaluateDriftGate, outputDriftTable };
