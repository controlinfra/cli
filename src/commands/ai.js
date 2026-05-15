const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');

/**
 * Show current AI provider status
 */
async function status(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching AI provider status...').start();

  try {
    const data = await integrations.getAiProvider();
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    outputBox('AI Provider', [
      `Provider:     ${brand.cyan(data.provider || 'default')}`,
      `Custom Key:   ${data.hasCustomKey ? chalk.green('Yes') : chalk.dim('No (using default)')}`,
    ].join('\n'));
    console.log();

    if (!data.hasCustomKey) {
      console.log(chalk.dim('Use your own API key with:'));
      console.log(brand.cyan('  controlinfra ai use anthropic --key <your-api-key>'));
      console.log(brand.cyan('  controlinfra ai use openai --key <your-api-key>\n'));
    }
  } catch (error) {
    spinner.fail('Failed to fetch AI provider status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Set AI provider
 */
async function use(provider, options) {
  requireAuth();

  const validProviders = ['anthropic', 'openai'];
  const normalizedProvider = provider.toLowerCase();

  if (!validProviders.includes(normalizedProvider)) {
    outputError(`Invalid provider. Choose: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  let apiKey = options.key;

  // Prompt for API key if not provided
  if (!apiKey) {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${provider} API key:`,
        mask: '*',
        validate: (input) => {
          if (normalizedProvider === 'anthropic' && !input.startsWith('sk-ant-')) {
            return 'Anthropic API keys typically start with sk-ant-';
          }
          if (normalizedProvider === 'openai' && !input.startsWith('sk-')) {
            return 'OpenAI API keys typically start with sk-';
          }
          return true;
        },
      },
    ]);
    apiKey = answers.apiKey;
  }

  // First verify the key
  const verifySpinner = createSpinner(`Verifying ${provider} API key...`).start();

  try {
    if (normalizedProvider === 'anthropic') {
      await integrations.verifyAnthropicKey(apiKey);
    } else {
      await integrations.verifyOpenaiKey(apiKey);
    }
    verifySpinner.succeed('API key verified');
  } catch (error) {
    verifySpinner.fail('Invalid API key');
    outputError(error.message);
    process.exit(1);
  }

  // Save the key
  const saveSpinner = createSpinner(`Saving ${provider} configuration...`).start();

  try {
    // Save the API key
    if (normalizedProvider === 'anthropic') {
      await integrations.saveAnthropicKey(apiKey);
    } else {
      await integrations.saveOpenaiKey(apiKey);
    }

    // Update the provider preference
    await integrations.updateAiProvider({ provider: normalizedProvider });

    saveSpinner.succeed(`${provider} configured as AI provider`);
    console.log(chalk.dim('\nAI-powered features will now use your API key.\n'));
  } catch (error) {
    saveSpinner.fail('Failed to save configuration');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Verify current AI provider key
 */
async function verify(_options) {
  requireAuth();

  const spinner = createSpinner('Verifying AI provider...').start();

  try {
    const data = await integrations.getAiProvider();

    if (!data.hasCustomKey) {
      spinner.warn('No custom API key configured');
      console.log(chalk.dim('\nUsing default Controlinfra AI. Set your own key with:'));
      console.log(brand.cyan('  controlinfra ai use anthropic --key <your-api-key>\n'));
      return;
    }

    // We can't re-verify the stored key without it — the server
    // doesn't return key material (correctly). Verification ran at
    // save time via the /verify endpoint, and the provider sub-system
    // flags failures via the org-level credential health check. To
    // re-verify against the provider now, the user can re-issue the
    // `ai use <provider> --key <new>` command which runs the live
    // verify path again.
    spinner.succeed(`${data.provider} API key is configured`);
    console.log(chalk.dim('\nThe key was verified against the provider when saved.'));
    console.log(chalk.dim('To re-verify with a fresh key, run:'), brand.cyan(`controlinfra ai use ${data.provider} --key <new-key>\n`));
  } catch (error) {
    spinner.fail('Failed to check AI provider');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove custom AI key (revert to default)
 */
async function remove(_options) {
  requireAuth();

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Remove custom AI key and use default Controlinfra AI?',
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('Cancelled\n'));
    return;
  }

  const spinner = createSpinner('Removing custom AI configuration...').start();

  try {
    await integrations.getAiProvider();

    // Delete both keys to be safe
    try {
      await integrations.deleteAnthropicKey();
    } catch (_e) {
      // Ignore if not set
    }

    try {
      await integrations.deleteOpenaiKey();
    } catch (_e) {
      // Ignore if not set
    }

    spinner.succeed('Custom AI key removed');
    console.log(chalk.dim('\nNow using default Controlinfra AI.\n'));
  } catch (error) {
    spinner.fail('Failed to remove AI configuration');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  status,
  use,
  verify,
  remove,
};
