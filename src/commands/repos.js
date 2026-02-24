const chalk = require('chalk');
const inquirer = require('inquirer');
const { repos } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  colorStatus,
  brand,
  formatRelativeTime,
} = require('../output');

/**
 * List configured repositories
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching repositories...').start();

  try {
    const data = await repos.list({ workspace: options.workspace });
    const repoList = data.configs || data.repositories || data || [];
    spinner.stop();

    // Handle JSON output first (even for empty results)
    // Navigate up: list -> repos -> program to get global --json option
    const isJson = command?.parent?.parent?.opts()?.json;
    if (isJson) {
      console.log(JSON.stringify(repoList, null, 2));
      return;
    }

    if (repoList.length === 0) {
      console.log(chalk.yellow('\nNo repositories configured\n'));
      console.log(chalk.dim('Add a repository with'), brand.cyan('controlinfra repos add <owner/repo>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Repository', 'Branch', 'Status', 'Last Scan'],
      repoList.map((repo) => [
        chalk.dim(repo._id?.slice(-8) || '-'),
        brand.cyan(repo.repository?.fullName || repo.fullName || '-'),
        repo.branch || 'main',
        colorStatus(repo.lastScanStatus || 'pending'),
        formatRelativeTime(repo.lastScanAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch repositories');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Add a new repository
 */
async function add(repository, options) {
  requireAuth();

  // Parse owner/repo format
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    outputError('Invalid repository format. Use: owner/repo');
    process.exit(1);
  }

  // Determine cloud provider
  const cloudProvider = options.cloudProvider || 'aws';
  if (!['aws', 'azure', 'gcp'].includes(cloudProvider)) {
    outputError('Invalid cloud provider. Must be: aws, azure, or gcp');
    process.exit(1);
  }

  const runnerType = options.runnerType || 'cloud';
  let awsConfig = null;
  let azureConfig = null;
  let gcpConfig = null;

  if (cloudProvider === 'aws') {
    // AWS validation
    const authMethod = options.authMethod || 'credentials';
    const validAuthMethods = ['credentials', 'instance_profile', 'assume_role'];
    if (!validAuthMethods.includes(authMethod)) {
      outputError(`Invalid AWS auth method. Must be one of: ${validAuthMethods.join(', ')}`);
      process.exit(1);
    }

    // Validate credentials auth requirements
    if (authMethod === 'credentials') {
      if (!options.accessKey || !options.secretKey) {
        outputError('AWS credentials required. Use --access-key and --secret-key options');
        process.exit(1);
      }
    }

    // Validate assume_role requirements
    if (authMethod === 'assume_role') {
      if (!options.roleArn) {
        outputError('Role ARN required for assume_role auth. Use --role-arn option');
        process.exit(1);
      }
    }

    // Validate self-hosted runner requirements for IAM methods
    if ((authMethod === 'instance_profile' || authMethod === 'assume_role') && runnerType !== 'self-hosted') {
      outputError(`${authMethod} authentication requires a self-hosted runner. Use --runner-type self-hosted`);
      process.exit(1);
    }

    // Build AWS config
    awsConfig = {
      authMethod,
      region: options.region || 'us-east-1',
    };

    if (authMethod === 'credentials') {
      awsConfig.accessKeyId = options.accessKey;
      awsConfig.secretAccessKey = options.secretKey;
    } else if (authMethod === 'assume_role') {
      awsConfig.roleArn = options.roleArn;
      if (options.externalId) {
        awsConfig.externalId = options.externalId;
      }
    }
  } else if (cloudProvider === 'azure') {
    // Azure validation
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

    // Build Azure config
    azureConfig = {
      authMethod: azureAuthMethod,
      subscriptionId: options.subscriptionId,
      environment: options.azureEnvironment || 'public',
    };

    if (azureAuthMethod === 'service_principal') {
      azureConfig.tenantId = options.tenantId;
      azureConfig.clientId = options.clientId;
      azureConfig.clientSecret = options.clientSecret;
    }
  } else if (cloudProvider === 'gcp') {
    // GCP validation
    const gcpAuthMethod = options.gcpAuthMethod || 'service_account';
    if (!['service_account', 'workload_identity'].includes(gcpAuthMethod)) {
      outputError('Invalid GCP auth method. Must be: service_account or workload_identity');
      process.exit(1);
    }

    // Handle JSON file import
    let projectId = options.gcpProjectId;
    let clientEmail = options.gcpClientEmail;
    let privateKey = options.gcpPrivateKey;

    if (options.gcpJsonFile) {
      try {
        const fs = require('fs');
        const jsonContent = fs.readFileSync(options.gcpJsonFile, 'utf8');
        const serviceAccount = JSON.parse(jsonContent);
        projectId = serviceAccount.project_id || projectId;
        clientEmail = serviceAccount.client_email || clientEmail;
        privateKey = serviceAccount.private_key || privateKey;
      } catch (err) {
        outputError(`Failed to read GCP JSON file: ${err.message}`);
        process.exit(1);
      }
    }

    if (gcpAuthMethod === 'service_account') {
      if (!projectId || !clientEmail || !privateKey) {
        outputError('GCP Service Account credentials required. Use --gcp-project-id, --gcp-client-email, --gcp-private-key options, or --gcp-json-file');
        process.exit(1);
      }
    } else if (gcpAuthMethod === 'workload_identity') {
      if (!projectId) {
        outputError('GCP Project ID required. Use --gcp-project-id option');
        process.exit(1);
      }
      if (runnerType !== 'self-hosted') {
        outputError('workload_identity authentication requires a self-hosted runner. Use --runner-type self-hosted');
        process.exit(1);
      }
    }

    // Build GCP config
    gcpConfig = {
      authMethod: gcpAuthMethod,
      projectId,
    };

    if (gcpAuthMethod === 'service_account') {
      gcpConfig.clientEmail = clientEmail;
      gcpConfig.privateKey = privateKey;
    }
  }

  // Validate self-hosted runner ID
  if (runnerType === 'self-hosted' && !options.runnerId) {
    outputError('Runner ID required for self-hosted runner. Use --runner-id option');
    process.exit(1);
  }

  const spinner = createSpinner(`Adding ${repository}...`).start();

  try {
    // First, fetch available repos to get the GitHub repository ID
    spinner.text = 'Fetching repository info from GitHub...';
    const availableRepos = await repos.listAvailable();
    const repoList = Array.isArray(availableRepos) ? availableRepos : (availableRepos.repositories || []);

    const githubRepo = repoList.find(
      (r) => (r.fullName || r.full_name)?.toLowerCase() === repository.toLowerCase(),
    );

    if (!githubRepo) {
      spinner.fail('Repository not found');
      outputError(`Repository "${repository}" not found in your GitHub account. Make sure you have access to it.`);
      process.exit(1);
    }

    // Build runner config
    const runnerConfig = {
      type: runnerType,
    };
    if (runnerType === 'self-hosted' && options.runnerId) {
      runnerConfig.runnerId = options.runnerId;
    }

    // Build the request payload matching the API format
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
      },
      cloudProvider,
      runnerConfig,
      scanConfig: {
        schedule: 'manual',
        enabled: true,
      },
      workspaceId: options.workspace,
    };

    if (awsConfig) {
      payload.awsConfig = awsConfig;
    }
    if (azureConfig) {
      payload.azureConfig = azureConfig;
    }
    if (gcpConfig) {
      payload.gcpConfig = gcpConfig;
    }

    const result = await repos.create(payload);

    spinner.succeed(`Repository ${brand.cyan(repository)} added successfully`);

    if (result.config?._id || result._id) {
      console.log(chalk.dim(`\nRepository ID: ${result.config?._id || result._id}`));
      console.log(chalk.dim('Trigger a scan with:'), brand.cyan(`controlinfra scan run ${repository}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to add repository');
    // Show detailed error from API response
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    outputError(errorMessage);
    if (error.response?.data?.details) {
      console.log(chalk.dim('Details:', error.response.data.details));
    }
    process.exit(1);
  }
}

/**
 * Resolve a partial ID to a full ID by matching against existing repos
 */
async function resolveRepoId(partialId) {
  const data = await repos.list({});
  const repoList = data.configs || data.repositories || data || [];

  // Try exact match first
  const exactMatch = repoList.find((r) => r._id === partialId);
  if (exactMatch) return exactMatch._id;

  // Try partial match (ID ends with the partial)
  const partialMatch = repoList.find((r) => r._id?.endsWith(partialId));
  if (partialMatch) return partialMatch._id;

  // Try matching by repository name
  const nameMatch = repoList.find(
    (r) => (r.repository?.fullName || r.fullName || '')
      .toLowerCase()
      .includes(partialId.toLowerCase()),
  );
  if (nameMatch) return nameMatch._id;

  return null;
}

/**
 * Remove a repository
 */
async function remove(id, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to remove this repository? This will delete all scan history.',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Removing repository...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    await repos.delete(fullId);
    spinner.succeed('Repository removed successfully');
  } catch (error) {
    spinner.fail('Failed to remove repository');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show repository details
 */
async function info(id, options) {
  requireAuth();

  const spinner = createSpinner('Fetching repository info...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    const data = await repos.get(fullId);
    const repo = data.repository || data.config || data;
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(repo, null, 2));
      return;
    }

    console.log();
    outputBox('Repository Details', [
      `Name:         ${brand.cyan(repo.repository?.fullName || '-')}`,
      `Branch:       ${repo.repository?.defaultBranch || repo.branch || 'main'}`,
      `Terraform:    ${repo.terraformConfig?.directory || repo.terraformDir || '.'}`,
      `Schedule:     ${repo.scanConfig?.schedule || repo.schedule || 'manual'}`,
      `Status:       ${colorStatus(repo.lastScan?.status || repo.lastScanStatus || 'pending')}`,
      `Last Scan:    ${formatRelativeTime(repo.lastScan?.completedAt || repo.lastScanAt)}`,
      `Created:      ${formatRelativeTime(repo.createdAt)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch repository info');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show repository statistics
 */
async function stats(id, options) {
  requireAuth();

  const spinner = createSpinner('Fetching statistics...').start();

  try {
    // Resolve partial ID to full ID
    const fullId = await resolveRepoId(id);
    if (!fullId) {
      spinner.fail('Repository not found');
      outputError(`No repository found matching "${id}"`);
      process.exit(1);
    }

    const data = await repos.getStats(fullId);
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    outputBox('Repository Statistics', [
      `Total Scans:      ${data.totalScans || 0}`,
      `Successful:       ${chalk.green(data.successfulScans || 0)}`,
      `Failed:           ${chalk.red(data.failedScans || 0)}`,
      `Total Drifts:     ${data.totalDrifts || 0}`,
      `Open Drifts:      ${chalk.yellow(data.openDrifts || 0)}`,
      `Resolved:         ${chalk.green(data.resolvedDrifts || 0)}`,
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
  add,
  remove,
  info,
  stats,
};
