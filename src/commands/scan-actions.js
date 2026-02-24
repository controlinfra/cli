const chalk = require('chalk');
const inquirer = require('inquirer');
const { scans } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, brand } = require('../output');
const { resolveScanId } = require('./scan-wait');

/**
 * Retry a failed scan
 */
async function retry(scanId, _options) {
  requireAuth();

  const spinner = createSpinner('Retrying scan...').start();

  try {
    const fullId = await resolveScanId(scanId);
    if (!fullId) {
      spinner.fail('Scan not found');
      outputError(`No scan found matching "${scanId}"`);
      process.exit(1);
    }

    const data = await scans.retry(fullId);
    const newScanId = data.scanId || data.scan?._id || data._id;
    spinner.succeed(`Scan retried: ${brand.cyan(newScanId)}`);
    console.log(chalk.dim(`\nCheck status with: controlinfra scan status ${newScanId}\n`));
  } catch (error) {
    spinner.fail('Failed to retry scan');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Delete a scan record
 */
async function deleteScan(scanId, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this scan? This cannot be undone.',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Deleting scan...').start();

  try {
    const fullId = await resolveScanId(scanId);
    if (!fullId) {
      spinner.fail('Scan not found');
      outputError(`No scan found matching "${scanId}"`);
      process.exit(1);
    }

    await scans.delete(fullId);
    spinner.succeed('Scan deleted successfully');
  } catch (error) {
    spinner.fail('Failed to delete scan');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { retry, deleteScan };
