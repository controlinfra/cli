const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox } = require('../output');

/**
 * Setup Slack integration
 */
async function setup(options) {
  requireAuth();

  let webhookUrl = options.webhook;

  // Interactive prompt if webhook not provided
  if (!webhookUrl) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'webhook',
        message: 'Enter your Slack webhook URL:',
        validate: (input) => {
          if (!input.startsWith('https://hooks.slack.com/')) {
            return 'Invalid Slack webhook URL. It should start with https://hooks.slack.com/';
          }
          return true;
        },
      },
    ]);
    webhookUrl = answers.webhook;
  }

  const spinner = createSpinner('Configuring Slack...').start();

  try {
    await integrations.updateSlack({
      enabled: true,
      webhookUrl,
    });
    spinner.succeed('Slack integration configured');

    console.log(chalk.dim('\nTest with:'), chalk.cyan('controlinfra slack test\n'));
  } catch (error) {
    spinner.fail('Failed to configure Slack');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Test Slack integration
 */
async function test(_options) {
  requireAuth();

  const spinner = createSpinner('Sending test message...').start();

  try {
    await integrations.testSlack();
    spinner.succeed('Test message sent to Slack');
  } catch (error) {
    spinner.fail('Failed to send test message');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show Slack integration status
 */
async function status(options) {
  requireAuth();

  const spinner = createSpinner('Fetching Slack status...').start();

  try {
    const data = await integrations.getSlack();
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    if (data.enabled) {
      outputBox('Slack Integration', [
        `Status:    ${chalk.green('Connected')}`,
        `Webhook:   ${chalk.dim(maskWebhook(data.webhookUrl))}`,
      ].join('\n'));
    } else {
      console.log(chalk.yellow('Slack integration not configured\n'));
      console.log(chalk.dim('Set up with:'), chalk.cyan('controlinfra slack setup\n'));
    }
  } catch (error) {
    spinner.fail('Failed to fetch Slack status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove Slack integration
 */
async function remove(_options) {
  requireAuth();

  const spinner = createSpinner('Removing Slack integration...').start();

  try {
    await integrations.deleteSlack();
    spinner.succeed('Slack integration removed');
  } catch (error) {
    spinner.fail('Failed to remove Slack integration');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Mask webhook URL for display
 */
function maskWebhook(url) {
  if (!url) return '-';
  const parts = url.split('/');
  if (parts.length > 4) {
    return `${parts.slice(0, 4).join('/')}/*****/***`;
  }
  return url;
}

module.exports = {
  setup,
  test,
  status,
  remove,
};
