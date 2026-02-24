const chalk = require('chalk');
const { drifts } = require('../api');
const { requireAuth } = require('../config');
const {
  brand,
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
    if (!Array.isArray(driftList)) driftList = [];
    spinner.stop();

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
      `Resource:    ${brand.cyan(drift.resource?.address || '-')}`,
      `Type:        ${drift.resource?.type || '-'}`,
      `Severity:    ${colorStatus(drift.severity)}`,
      `Status:      ${colorStatus(drift.status)}`,
      `Action:      ${drift.action || '-'}`,
      `Detected:    ${formatRelativeTime(drift.createdAt)}`,
    ].join('\n'));

    if (drift.changes && drift.changes.length > 0) {
      console.log(brand.purpleBold('\nChanges:'));
      console.log(chalk.dim('─'.repeat(60)));
      drift.changes.forEach((change) => {
        console.log(`  ${chalk.yellow(change.attribute || change.path)}:`);
        console.log(`    ${chalk.red('- ' + (change.before || 'null'))}`);
        console.log(`    ${chalk.green('+ ' + (change.after || 'null'))}`);
      });
    }

    if (drift.aiAnalysis) {
      console.log(brand.purpleBold('\nAI Analysis:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(`  ${drift.aiAnalysis.summary || drift.aiAnalysis}`);
    }

    if (drift.fixCode) {
      console.log(brand.purpleBold('\nGenerated Fix:'));
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
      console.log(brand.purpleBold('\nGenerated Fix:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(drift.fixCode);
      console.log(chalk.dim('─'.repeat(60)));
      console.log(chalk.dim('\nCreate PR with:'), brand.cyan(`controlinfra drifts pr ${driftId}\n`));
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
      console.log(brand.cyan(`\nPR URL: ${pr.url || pr.html_url}\n`));
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

module.exports = {
  list,
  show,
  fix,
  createPR,
  ignore,
  resolve,
};
