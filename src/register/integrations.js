import * as slackCommands from '../commands/slack.js';
import * as awsCommands from '../commands/aws.js';
import * as azureCommands from '../commands/azure.js';
import * as gcpCommands from '../commands/gcp.js';
import * as aiCommands from '../commands/ai.js';

function registerIntegrations(program) {
  // Slack
  const slack = program.command('slack').description('Slack integration');

  slack
    .command('setup')
    .description('Configure Slack webhook')
    .option('--webhook <url>', 'Slack webhook URL')
    .action(slackCommands.setup);

  slack
    .command('test')
    .description('Send test message to Slack')
    .option('--message <text>', 'Custom test message')
    .action(slackCommands.test);

  slack
    .command('status')
    .description('Show Slack integration status')
    .action(slackCommands.status);

  slack
    .command('remove')
    .description('Remove Slack integration')
    .action(slackCommands.remove);

  // AWS
  const aws = program.command('aws').description('AWS credentials management');

  aws
    .command('setup')
    .description('Configure AWS credentials')
    .option('--access-key <key>', 'AWS Access Key ID')
    .option('--secret-key <key>', 'AWS Secret Access Key')
    .option('--region <region>', 'AWS Region', 'us-east-1')
    .action(awsCommands.setup);

  aws
    .command('status')
    .description('Show AWS credentials status')
    .action(awsCommands.status);

  aws
    .command('test')
    .description('Validate AWS credentials')
    .action(awsCommands.test);

  aws
    .command('remove')
    .description('Remove AWS credentials')
    .option('--force', 'Skip confirmation prompt')
    .action(awsCommands.remove);

  // Azure
  const azure = program.command('azure').description('Azure credentials management');

  azure
    .command('setup')
    .description('Configure Azure credentials')
    .option('--subscription-id <id>', 'Azure Subscription ID')
    .option('--tenant-id <id>', 'Azure Tenant ID')
    .option('--client-id <id>', 'Azure Client ID (Application ID)')
    .option('--client-secret <secret>', 'Azure Client Secret')
    .option('--environment <env>', 'Azure Environment (public, usgovernment, german, china)', 'public')
    .action(azureCommands.setup);

  azure
    .command('status')
    .description('Show Azure credentials status')
    .action(azureCommands.status);

  azure
    .command('test')
    .description('Check if Azure credentials are configured')
    .action(azureCommands.test);

  azure
    .command('remove')
    .description('Remove Azure credentials')
    .option('--force', 'Skip confirmation prompt')
    .action(azureCommands.remove);

  // GCP
  const gcp = program.command('gcp').description('GCP credentials management');

  gcp
    .command('setup')
    .description('Configure GCP credentials')
    .option('--json-file <path>', 'Path to service account JSON key file')
    .option('--project-id <id>', 'GCP Project ID')
    .option('--client-email <email>', 'Service Account email')
    .option('--private-key <key>', 'Private key (PEM format)')
    .option('--workload-identity', 'Use Workload Identity (GKE/Cloud Run metadata)')
    // Workload Identity Federation — zero-credential auth via Controlinfra-signed
    // OIDC token. Shipped end-to-end in the multi-cloud parity bundle but the
    // CLI had no flag for it, so WIF customers couldn't run `gcp setup` from
    // the terminal — UI-only workaround until now.
    .option('--workload-identity-federation', 'Use Workload Identity Federation (OIDC-based, no service account key)')
    .option('--audience <urn>', 'WIF pool/provider audience: //iam.googleapis.com/projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>')
    .option('--service-account-email <email>', 'Service account to impersonate after WIF token exchange')
    .action(gcpCommands.setup);

  gcp
    .command('status')
    .description('Show GCP credentials status')
    .action(gcpCommands.status);

  gcp
    .command('test')
    .description('Check if GCP credentials are configured')
    .action(gcpCommands.test);

  gcp
    .command('remove')
    .description('Remove GCP credentials')
    .option('--force', 'Skip confirmation prompt')
    .action(gcpCommands.remove);

  // AI Provider
  const ai = program.command('ai').description('AI provider configuration');

  ai
    .command('status')
    .description('Show current AI provider')
    .action(aiCommands.status);

  ai
    .command('use <provider>')
    .description('Set AI provider (anthropic, openai)')
    .option('--key <api-key>', 'API key for the provider')
    .action(aiCommands.use);

  ai
    .command('verify')
    .description('Verify AI provider API key')
    .action(aiCommands.verify);

  ai
    .command('remove')
    .description('Remove custom AI key (use default)')
    .action(aiCommands.remove);
}

export default registerIntegrations;