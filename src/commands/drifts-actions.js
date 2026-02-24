const fs = require('fs');
const chalk = require('chalk');
const { drifts } = require('../api');
const { requireAuth } = require('../config');
const {
  brand,
  createSpinner,
  outputError,
  outputBox,
} = require('../output');

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
      brand.purpleBold('By Severity:'),
      `  Critical:     ${chalk.red(data.bySeverity?.critical || 0)}`,
      `  High:         ${chalk.yellow(data.bySeverity?.high || 0)}`,
      `  Medium:       ${chalk.blue(data.bySeverity?.medium || 0)}`,
      `  Low:          ${chalk.gray(data.bySeverity?.low || 0)}`,
      '',
      brand.purpleBold('By Status:'),
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

/**
 * Reanalyze a drift with AI
 */
async function reanalyze(driftId, _options) {
  requireAuth();

  const spinner = createSpinner('Reanalyzing drift...').start();

  try {
    const data = await drifts.reanalyze(driftId);
    spinner.succeed('Drift reanalysis started');

    const drift = data.drift || data;
    if (drift.aiAnalysis) {
      console.log(brand.purpleBold('\nAI Analysis:'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(`  ${drift.aiAnalysis.summary || drift.aiAnalysis}`);
      console.log();
    }
  } catch (error) {
    spinner.fail('Failed to reanalyze drift');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Export drifts to JSON file
 */
async function exportDrifts(options) {
  requireAuth();

  const spinner = createSpinner('Exporting drifts...').start();

  try {
    const params = {};
    if (options.repo) params.repositoryConfigId = options.repo;
    if (options.status) params.status = options.status;

    const data = await drifts.list({ ...params, limit: 10000 });
    const driftList = data.drifts || data || [];
    spinner.stop();

    const output = JSON.stringify(driftList, null, 2);

    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf8');
      console.log(chalk.green(`\nExported ${driftList.length} drift(s) to ${options.output}\n`));
    } else {
      console.log(output);
    }
  } catch (error) {
    spinner.fail('Failed to export drifts');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { stats, reanalyze, exportDrifts };
