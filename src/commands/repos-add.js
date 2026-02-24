const chalk = require('chalk');
const { repos } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, brand } = require('../output');

/**
 * Build cloud-provider config from CLI options
 */
function buildCloudConfig(cloudProvider, options) {
  const runnerType = options.runnerType || 'cloud';

  if (cloudProvider === 'aws') {
    return buildAwsConfig(options, runnerType);
  } else if (cloudProvider === 'azure') {
    return buildAzureConfig(options, runnerType);
  } else if (cloudProvider === 'gcp') {
    return buildGcpConfig(options, runnerType);
  }
  return {};
}

function buildAwsConfig(options, runnerType) {
  const authMethod = options.authMethod || 'credentials';
  const validAuthMethods = ['credentials', 'instance_profile', 'assume_role'];
  if (!validAuthMethods.includes(authMethod)) {
    outputError(`Invalid AWS auth method. Must be one of: ${validAuthMethods.join(', ')}`);
    process.exit(1);
  }

  if (authMethod === 'credentials' && (!options.accessKey || !options.secretKey)) {
    outputError('AWS credentials required. Use --access-key and --secret-key options');
    process.exit(1);
  }

  if (authMethod === 'assume_role' && !options.roleArn) {
    outputError('Role ARN required for assume_role auth. Use --role-arn option');
    process.exit(1);
  }

  if ((authMethod === 'instance_profile' || authMethod === 'assume_role') && runnerType !== 'self-hosted') {
    outputError(`${authMethod} authentication requires a self-hosted runner. Use --runner-type self-hosted`);
    process.exit(1);
  }

  const awsConfig = { authMethod, region: options.region || 'us-east-1' };

  if (authMethod === 'credentials') {
    awsConfig.accessKeyId = options.accessKey;
    awsConfig.secretAccessKey = options.secretKey;
  } else if (authMethod === 'assume_role') {
    awsConfig.roleArn = options.roleArn;
    if (options.externalId) awsConfig.externalId = options.externalId;
  }

  return { awsConfig };
}

function buildAzureConfig(options, runnerType) {
  const azureAuthMethod = options.azureAuthMethod || 'service_principal';
  if (!['service_principal', 'managed_identity'].includes(azureAuthMethod)) {
    outputError('Invalid Azure auth method. Must be: service_principal or managed_identity');
    process.exit(1);
  }

  if (azureAuthMethod === 'service_principal') {
    if (!options.subscriptionId || !options.tenantId || !options.clientId || !options.clientSecret) {
      outputError('Azure Service Principal credentials required. Use --subscription-id, --tenant-id, --client-id, and --client-secret options');
      process.exit(1);
    }
  } else if (azureAuthMethod === 'managed_identity') {
    if (!options.subscriptionId) {
      outputError('Azure Subscription ID required. Use --subscription-id option');
      process.exit(1);
    }
    if (runnerType !== 'self-hosted') {
      outputError('managed_identity authentication requires a self-hosted runner. Use --runner-type self-hosted');
      process.exit(1);
    }
  }

  const azureConfig = {
    authMethod: azureAuthMethod,
    subscriptionId: options.subscriptionId,
    environment: options.azureEnvironment || 'public',
  };

  if (azureAuthMethod === 'service_principal') {
    azureConfig.tenantId = options.tenantId;
    azureConfig.clientId = options.clientId;
    azureConfig.clientSecret = options.clientSecret;
  }

  return { azureConfig };
}

function buildGcpConfig(options, runnerType) {
  const gcpAuthMethod = options.gcpAuthMethod || 'service_account';
  if (!['service_account', 'workload_identity'].includes(gcpAuthMethod)) {
    outputError('Invalid GCP auth method. Must be: service_account or workload_identity');
    process.exit(1);
  }

  let projectId = options.gcpProjectId;
  let clientEmail = options.gcpClientEmail;
  let privateKey = options.gcpPrivateKey;

  if (options.gcpJsonFile) {
    try {
      const fs = require('fs');
      const jsonContent = fs.readFileSync(options.gcpJsonFile, 'utf8');
      const sa = JSON.parse(jsonContent);
      projectId = sa.project_id || projectId;
      clientEmail = sa.client_email || clientEmail;
      privateKey = sa.private_key || privateKey;
    } catch (err) {
      outputError(`Failed to read GCP JSON file: ${err.message}`);
      process.exit(1);
    }
  }

  if (gcpAuthMethod === 'service_account' && (!projectId || !clientEmail || !privateKey)) {
    outputError('GCP Service Account credentials required. Use --gcp-project-id, --gcp-client-email, --gcp-private-key options, or --gcp-json-file');
    process.exit(1);
  }
  if (gcpAuthMethod === 'workload_identity') {
    if (!projectId) {
      outputError('GCP Project ID required. Use --gcp-project-id option');
      process.exit(1);
    }
    if (runnerType !== 'self-hosted') {
      outputError('workload_identity authentication requires a self-hosted runner. Use --runner-type self-hosted');
      process.exit(1);
    }
  }

  const gcpConfig = { authMethod: gcpAuthMethod, projectId };
  if (gcpAuthMethod === 'service_account') {
    gcpConfig.clientEmail = clientEmail;
    gcpConfig.privateKey = privateKey;
  }

  return { gcpConfig };
}

/**
 * Add a new repository
 */
async function add(repository, options) {
  requireAuth();

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    outputError('Invalid repository format. Use: owner/repo');
    process.exit(1);
  }

  const cloudProvider = options.cloudProvider || 'aws';
  if (!['aws', 'azure', 'gcp'].includes(cloudProvider)) {
    outputError('Invalid cloud provider. Must be: aws, azure, or gcp');
    process.exit(1);
  }

  const runnerType = options.runnerType || 'cloud';
  if (runnerType === 'self-hosted' && !options.runnerId) {
    outputError('Runner ID required for self-hosted runner. Use --runner-id option');
    process.exit(1);
  }

  const cloudConfig = buildCloudConfig(cloudProvider, options);

  const spinner = createSpinner(`Adding ${repository}...`).start();

  try {
    spinner.text = 'Fetching repository info from GitHub...';
    const availableRepos = await repos.listAvailable();
    const repoList = Array.isArray(availableRepos) ? availableRepos : (availableRepos.repositories || []);

    const githubRepo = repoList.find(
      (r) => (r.fullName || r.full_name)?.toLowerCase() === repository.toLowerCase(),
    );

    if (!githubRepo) {
      spinner.fail('Repository not found');
      outputError(`Repository "${repository}" not found in your GitHub account.`);
      process.exit(1);
    }

    const runnerConfig = { type: runnerType };
    if (runnerType === 'self-hosted' && options.runnerId) {
      runnerConfig.runnerId = options.runnerId;
    }

    spinner.text = `Adding ${repository}...`;
    const payload = {
      repository: {
        id: githubRepo.id,
        name: githubRepo.name,
        fullName: githubRepo.fullName || githubRepo.full_name,
        owner: githubRepo.owner?.login || owner,
        url: githubRepo.url || `https://github.com/${repository}`,
        cloneUrl: githubRepo.cloneUrl || `https://github.com/${repository}.git`,
        defaultBranch: options.branch || githubRepo.defaultBranch || githubRepo.default_branch || 'main',
        isPrivate: githubRepo.isPrivate ?? githubRepo.private ?? false,
      },
      terraformConfig: {
        directory: options.terraformDir || '.',
        version: options.tfVersion || undefined,
        workspace: options.tfWorkspace || undefined,
        varFiles: options.tfVarFiles ? options.tfVarFiles.split(',').map(f => f.trim()) : undefined,
        variables: options.tfVariables ? parseTfVariables(options.tfVariables) : undefined,
      },
      cloudProvider,
      runnerConfig,
      scanConfig: {
        schedule: options.schedule || 'manual',
        scheduleHour: options.scheduleHour ? parseInt(options.scheduleHour, 10) : undefined,
        scheduleDay: options.scheduleDay ? parseInt(options.scheduleDay, 10) : undefined,
        autoCreatePr: options.autoCreatePr || false,
        autoPrThreshold: options.autoPrThreshold || undefined,
        enabled: true,
      },
      workspaceId: options.workspace,
      ...cloudConfig,
    };

    const result = await repos.create(payload);
    spinner.succeed(`Repository ${brand.cyan(repository)} added successfully`);

    if (result.config?._id || result._id) {
      console.log(chalk.dim(`\nRepository ID: ${result.config?._id || result._id}`));
      console.log(chalk.dim('Trigger a scan with:'), brand.cyan(`controlinfra scan run ${repository}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to add repository');
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    outputError(errorMessage);
    if (error.response?.data?.details) {
      console.log(chalk.dim('Details:', error.response.data.details));
    }
    process.exit(1);
  }
}

function parseTfVariables(varsString) {
  const vars = {};
  varsString.split(',').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key && rest.length > 0) vars[key.trim()] = rest.join('=').trim();
  });
  return vars;
}

module.exports = { add };
