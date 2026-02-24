const chalk = require('chalk');
const { runners } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');
const { resolveRunnerId } = require('./runners-setup');

/**
 * Update runner configuration
 */
async function update(runnerId, options) {
  requireAuth();

  const spinner = createSpinner('Updating runner...').start();

  try {
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    const updates = {};
    if (options.name) updates.name = options.name;
    if (options.description) updates.description = options.description;
    if (options.labels) {
      updates.labels = options.labels.split(',').map((l) => l.trim());
    }

    if (Object.keys(updates).length === 0) {
      spinner.warn('No updates specified');
      console.log(chalk.dim('\nUse --name, --description, or --labels to update\n'));
      return;
    }

    const data = await runners.update(fullId, updates);
    const runner = data.runner || data;
    spinner.succeed('Runner updated successfully');

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(runner, null, 2));
      return;
    }

    console.log();
    outputBox('Updated Runner', [
      `ID:      ${chalk.dim(runner.id || runner._id || fullId)}`,
      `Name:    ${brand.cyan(runner.name || '-')}`,
      `Labels:  ${(runner.labels || []).join(', ') || '-'}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to update runner');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Mark a runner as offline
 */
async function markOffline(runnerId, _options) {
  requireAuth();

  const spinner = createSpinner('Marking runner as offline...').start();

  try {
    const fullId = await resolveRunnerId(runnerId);
    if (!fullId) {
      spinner.fail('Runner not found');
      outputError(`No runner found matching "${runnerId}"`);
      process.exit(1);
    }

    await runners.markOffline(fullId);
    spinner.succeed('Runner marked as offline');
  } catch (error) {
    spinner.fail('Failed to mark runner as offline');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { update, markOffline };
