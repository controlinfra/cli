const chalk = require('chalk');
const { drifts } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  colorStatus,
  formatRelativeTime,
  truncate,
} = require('../output');

/**
 * List drifts
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching drifts...').start();

  try {
    let data;
    if (options.scan) {
      data = await drifts.getByScan(options.scan);
    } else if (options.repo) {
      data = await drifts.getByRepository(options.repo);
    } else {
      data = await drifts.list({
        severity: options.severity,
        status: options.status,
        limit: options.limit,
      });
    }

    let driftList = data.drifts || data.data || data || [];
    // Ensure it's an array
    if (!Array.isArray(driftList)) {
      driftList = [];
    }
    spinner.stop();

    // Handle JSON output first (even for empty results)
    // Navigate up: list -> drifts -> program to get global --json option
    const isJson = command?.parent?.parent?.opts()?.json;
    if (isJson) {
      console.log(JSON.stringify(driftList, null, 2));
      return;
    }

    if (driftList.length === 0) {
      console.log(chalk.green('\nNo drifts found\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Resource', 'Severity', 'Status', 'Action', 'Detected'],
      driftList.map((drift) => [
        chalk.dim(drift._id?.slice(-8) || '-'),
        truncate(drift.resource?.address || '-', 35),
        colorStatus(drift.severity),
        colorStatus(drift.status),
        drift.action || '-',
        formatRelativeTime(drift.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch drifts');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show drift details
 */
async function show(driftId, options) {
  requireAuth();

  const spinner = createSpinner('Fetching drift details...').start();

  try {
    const data = await drifts.get(driftId);
    const drift = data.drift || data;
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(drift, null, 2));
      return;
    }

    console.log();
    outputBox('Drift Details', [
      `ID:          ${chalk.dim(drift._id)}`,
      `Resource:    ${chalk.cyan(drift.resource?.address || '-')}`,
      `Type:        ${drift.resource?.type || '-'}`,
      `Severity:    ${colorStatus(drift.severity)}`,
      `Status:      ${colorStatus(drift.status)}`,
      `Action:      ${drift.action || '-'}`,
      `Detected:    ${formatRelativeTime(drift.createdAt)}`,
    ].join('\n'));

    // Show changes if available
    if (drift.changes && drift.changes.length > 0) {
      console.log(chalk.cyan('\nChanges:'));
      console.log(chalk.dim('─'.repeat(60)));
      drift.changes.forEach((change) => {
        console.log(`  ${chalk.yellow(change.attribute || change.path)}:`);
        console.log(`    ${chalk.red('- ' + (change.before || 'null'))}`);
        console.log(`    ${chalk.green('+ ' + (change.after || 'null'))}`);
      });
    }

    // Show AI analysis if available
    if (drift.aiAnalysis) {
      console.log(chalk.cyan('\nAI Analysis:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(`  ${drift.aiAnalysis.summary || drift.aiAnalysis}`);
    }

    // Show fix if available
    if (drift.fixCode) {
      console.log(chalk.cyan('\nGenerated Fix:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(drift.fixCode);
    }

    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch drift details');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Generate AI fix for drift
 */
async function fix(driftId, options) {
  requireAuth();

  const spinner = createSpinner('Generating fix with AI...').start();

  try {
    const data = await drifts.generateFix(driftId, {
      provider: options.provider,
    });

    spinner.succeed('Fix generated successfully');

    const drift = data.drift || data;

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (drift.fixCode) {
      console.log(chalk.cyan('\nGenerated Fix:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(drift.fixCode);
      console.log(chalk.dim('─'.repeat(60)));
      console.log(chalk.dim('\nCreate PR with:'), chalk.cyan(`controlinfra drifts pr ${driftId}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to generate fix');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create PR with fix
 */
async function createPR(driftId, options) {
  requireAuth();

  const spinner = createSpinner('Creating pull request...').start();

  try {
    const data = await drifts.createPR(driftId, {
      autoMerge: options.autoMerge,
    });

    spinner.succeed('Pull request created');

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const pr = data.pullRequest || data.pr || data;
    if (pr.url || pr.html_url) {
      console.log(chalk.cyan(`\nPR URL: ${pr.url || pr.html_url}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to create pull request');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Ignore a drift
 */
async function ignore(driftId, _options) {
  requireAuth();

  const spinner = createSpinner('Marking drift as ignored...').start();

  try {
    await drifts.updateStatus(driftId, 'ignored');
    spinner.succeed('Drift marked as ignored');
  } catch (error) {
    spinner.fail('Failed to update drift');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Resolve a drift
 */
async function resolve(driftId, _options) {
  requireAuth();

  const spinner = createSpinner('Marking drift as resolved...').start();

  try {
    await drifts.updateStatus(driftId, 'resolved');
    spinner.succeed('Drift marked as resolved');
  } catch (error) {
    spinner.fail('Failed to update drift');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show drift statistics
 */
async function stats(options) {
  requireAuth();

  const spinner = createSpinner('Fetching statistics...').start();

  try {
    let data;
    if (options.repo) {
      data = await drifts.getStatistics(options.repo);
    } else {
      // Get general stats from list
      const allDrifts = await drifts.list({ limit: 1000 });
      const driftList = allDrifts.drifts || allDrifts || [];

      data = {
        total: driftList.length,
        bySeverity: {
          critical: driftList.filter((d) => d.severity === 'critical').length,
          high: driftList.filter((d) => d.severity === 'high').length,
          medium: driftList.filter((d) => d.severity === 'medium').length,
          low: driftList.filter((d) => d.severity === 'low').length,
        },
        byStatus: {
          detected: driftList.filter((d) => d.status === 'detected').length,
          analyzed: driftList.filter((d) => d.status === 'analyzed').length,
          resolved: driftList.filter((d) => d.status === 'resolved').length,
          ignored: driftList.filter((d) => d.status === 'ignored').length,
        },
      };
    }

    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    outputBox('Drift Statistics', [
      `Total Drifts:   ${data.total || 0}`,
      '',
      chalk.cyan('By Severity:'),
      `  Critical:     ${chalk.red(data.bySeverity?.critical || 0)}`,
      `  High:         ${chalk.yellow(data.bySeverity?.high || 0)}`,
      `  Medium:       ${chalk.blue(data.bySeverity?.medium || 0)}`,
      `  Low:          ${chalk.gray(data.bySeverity?.low || 0)}`,
      '',
      chalk.cyan('By Status:'),
      `  Detected:     ${data.byStatus?.detected || 0}`,
      `  Analyzed:     ${data.byStatus?.analyzed || 0}`,
      `  Resolved:     ${chalk.green(data.byStatus?.resolved || 0)}`,
      `  Ignored:      ${chalk.gray(data.byStatus?.ignored || 0)}`,
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
  show,
  fix,
  createPR,
  ignore,
  resolve,
  stats,
};
