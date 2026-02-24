const chalk = require('chalk');
const { repos } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');
const { resolveRepoId } = require('./repos');

/**
 * Update a repository configuration
 */
async function update(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Updating repository...').start();

  try {
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    const updates = {};

    // Basic config
    if (options.branch) {
      updates.branch = options.branch;
    }
    if (options.terraformDir) {
      updates.terraformConfig = { ...(updates.terraformConfig || {}), directory: options.terraformDir };
    }
    if (options.tfVersion) {
      updates.terraformConfig = { ...(updates.terraformConfig || {}), version: options.tfVersion };
    }
    if (options.tfWorkspace) {
      updates.terraformConfig = { ...(updates.terraformConfig || {}), workspace: options.tfWorkspace };
    }
    if (options.tfVarFiles) {
      updates.terraformConfig = {
        ...(updates.terraformConfig || {}),
        varFiles: options.tfVarFiles.split(',').map(f => f.trim()),
      };
    }
    if (options.tfVariables) {
      const vars = {};
      options.tfVariables.split(',').forEach(pair => {
        const [key, ...rest] = pair.trim().split('=');
        if (key && rest.length > 0) vars[key.trim()] = rest.join('=').trim();
      });
      updates.terraformConfig = { ...(updates.terraformConfig || {}), variables: vars };
    }

    // Scan config
    if (options.schedule) {
      updates.scanConfig = { ...(updates.scanConfig || {}), schedule: options.schedule };
    }
    if (options.scheduleHour) {
      updates.scanConfig = { ...(updates.scanConfig || {}), scheduleHour: parseInt(options.scheduleHour, 10) };
    }
    if (options.scheduleDay) {
      updates.scanConfig = { ...(updates.scanConfig || {}), scheduleDay: parseInt(options.scheduleDay, 10) };
    }
    if (options.autoCreatePr) {
      updates.scanConfig = { ...(updates.scanConfig || {}), autoCreatePr: options.autoCreatePr === 'true' };
    }
    if (options.autoPrThreshold) {
      updates.scanConfig = { ...(updates.scanConfig || {}), autoPrThreshold: options.autoPrThreshold };
    }

    // Cloud provider
    if (options.cloudProvider) {
      updates.cloudProvider = options.cloudProvider;
    }

    // Runner config
    if (options.runnerType) {
      updates.runnerConfig = { type: options.runnerType };
      if (options.runnerType === 'self-hosted' && options.runnerId) {
        updates.runnerConfig.runnerId = options.runnerId;
      }
    }

    // AWS config
    if (options.authMethod || options.region || options.accessKey || options.secretKey || options.roleArn) {
      updates.awsConfig = {};
      if (options.authMethod) updates.awsConfig.authMethod = options.authMethod;
      if (options.region) updates.awsConfig.region = options.region;
      if (options.accessKey) updates.awsConfig.accessKeyId = options.accessKey;
      if (options.secretKey) updates.awsConfig.secretAccessKey = options.secretKey;
      if (options.roleArn) updates.awsConfig.roleArn = options.roleArn;
      if (options.externalId) updates.awsConfig.externalId = options.externalId;
    }

    // Azure config
    if (options.azureAuthMethod || options.subscriptionId || options.tenantId || options.clientId) {
      updates.azureConfig = {};
      if (options.azureAuthMethod) updates.azureConfig.authMethod = options.azureAuthMethod;
      if (options.subscriptionId) updates.azureConfig.subscriptionId = options.subscriptionId;
      if (options.tenantId) updates.azureConfig.tenantId = options.tenantId;
      if (options.clientId) updates.azureConfig.clientId = options.clientId;
      if (options.clientSecret) updates.azureConfig.clientSecret = options.clientSecret;
    }

    // GCP config
    if (options.gcpAuthMethod || options.gcpProjectId || options.gcpClientEmail || options.gcpJsonFile) {
      updates.gcpConfig = {};
      if (options.gcpAuthMethod) updates.gcpConfig.authMethod = options.gcpAuthMethod;
      if (options.gcpProjectId) updates.gcpConfig.projectId = options.gcpProjectId;
      if (options.gcpClientEmail) updates.gcpConfig.clientEmail = options.gcpClientEmail;
      if (options.gcpPrivateKey) updates.gcpConfig.privateKey = options.gcpPrivateKey;

      if (options.gcpJsonFile) {
        try {
          const fs = require('fs');
          const jsonContent = fs.readFileSync(options.gcpJsonFile, 'utf8');
          const sa = JSON.parse(jsonContent);
          updates.gcpConfig.projectId = sa.project_id || updates.gcpConfig.projectId;
          updates.gcpConfig.clientEmail = sa.client_email || updates.gcpConfig.clientEmail;
          updates.gcpConfig.privateKey = sa.private_key || updates.gcpConfig.privateKey;
        } catch (err) {
          spinner.fail('Failed to read GCP JSON file');
          outputError(err.message);
          process.exit(1);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      spinner.warn('No updates specified');
      console.log(chalk.dim('\nUse --help to see available options\n'));
      return;
    }

    const result = await repos.update(fullId, updates);
    const repo = result.config || result.repository || result;
    spinner.succeed('Repository updated successfully');

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(repo, null, 2));
      return;
    }

    console.log();
    outputBox('Updated Repository', [
      `ID:          ${chalk.dim(repo._id || fullId)}`,
      `Repository:  ${brand.cyan(repo.repository?.fullName || '-')}`,
      `Branch:      ${repo.branch || repo.repository?.defaultBranch || 'main'}`,
      `Schedule:    ${repo.scanConfig?.schedule || 'manual'}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to update repository');
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    outputError(errorMessage);
    process.exit(1);
  }
}

module.exports = { update };
