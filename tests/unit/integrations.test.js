'use strict';

jest.mock('../../src/api', () => ({
  integrations: {
    updateSlack: jest.fn(), testSlack: jest.fn(), getSlack: jest.fn(), deleteSlack: jest.fn(),
    saveAwsCredentials: jest.fn(), getAwsCredentials: jest.fn(), deleteAwsCredentials: jest.fn(),
    saveAzureCredentials: jest.fn(), getAzureCredentials: jest.fn(), deleteAzureCredentials: jest.fn(),
    saveGcpCredentials: jest.fn(), getGcpCredentials: jest.fn(), deleteGcpCredentials: jest.fn(),
    getAiProvider: jest.fn(), updateAiProvider: jest.fn(),
    verifyAnthropicKey: jest.fn(), saveAnthropicKey: jest.fn(), deleteAnthropicKey: jest.fn(),
    verifyOpenaiKey: jest.fn(), saveOpenaiKey: jest.fn(), deleteOpenaiKey: jest.fn(),
  },
}));
jest.mock('../../src/config', () => ({ requireAuth: jest.fn(), saveAuth: jest.fn(), getUser: jest.fn(), isAuthenticated: jest.fn() }));
const mockSpinner = { start: jest.fn().mockReturnThis(), stop: jest.fn(), succeed: jest.fn(), fail: jest.fn(), warn: jest.fn() };
jest.mock('../../src/output', () => ({
  brand: { purple: jest.fn((s) => s), purpleBold: jest.fn((s) => s), mid: jest.fn((s) => s), light: jest.fn((s) => s), cyan: jest.fn((s) => s), cyanBold: jest.fn((s) => s), gradient: Array(6).fill(jest.fn((s) => s)) },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(), outputInfo: jest.fn(), outputTable: jest.fn(), outputBox: jest.fn(), formatRelativeTime: jest.fn((d) => d),
}));
jest.mock('inquirer', () => ({ prompt: jest.fn() }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(), readFileSync: jest.fn() }));

const api = require('../../src/api');
const output = require('../../src/output');
const inquirer = require('inquirer');
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const jsonCmd = (json) => ({ parent: { parent: { opts: () => ({ json }) } } });

describe('slack', () => {
  const slack = require('../../src/commands/slack');
  beforeEach(() => jest.clearAllMocks());

  it('setup prompts for webhook and saves', async () => {
    inquirer.prompt.mockResolvedValue({ webhook: 'https://hooks.slack.com/T1/B1/x' });
    api.integrations.updateSlack.mockResolvedValue({});
    await slack.setup({});
    expect(api.integrations.updateSlack).toHaveBeenCalledWith({ enabled: true, webhookUrl: 'https://hooks.slack.com/T1/B1/x' });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Slack integration configured');
  });
  it('setup uses --webhook option without prompting', async () => {
    api.integrations.updateSlack.mockResolvedValue({});
    await slack.setup({ webhook: 'https://hooks.slack.com/T1/B1/y' });
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });
  it('setup exits on API error', async () => {
    api.integrations.updateSlack.mockRejectedValue(new Error('fail'));
    await expect(slack.setup({ webhook: 'https://hooks.slack.com/x' })).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('fail');
  });
  it('test sends test message', async () => {
    api.integrations.testSlack.mockResolvedValue({});
    await slack.test({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Test message sent to Slack');
  });
  it('test exits on error', async () => {
    api.integrations.testSlack.mockRejectedValue(new Error('no webhook'));
    await expect(slack.test({})).rejects.toThrow('process.exit');
  });
  it('status shows connected info', async () => {
    api.integrations.getSlack.mockResolvedValue({ enabled: true, webhookUrl: 'https://hooks.slack.com/T/B/x' });
    await slack.status({}, jsonCmd(false));
    expect(output.outputBox).toHaveBeenCalled();
  });
  it('status outputs JSON when flag set', async () => {
    const data = { enabled: true, webhookUrl: 'https://hooks.slack.com/T/B/x' };
    api.integrations.getSlack.mockResolvedValue(data);
    await slack.status({}, jsonCmd(true));
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
  it('remove deletes slack integration', async () => {
    api.integrations.deleteSlack.mockResolvedValue({});
    await slack.remove({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Slack integration removed');
  });
});

describe('aws', () => {
  const aws = require('../../src/commands/aws');
  const validKey = 'AKIAIOSFODNN7EXAM';
  const validSecret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  beforeEach(() => jest.clearAllMocks());

  it('setup prompts and saves credentials', async () => {
    inquirer.prompt.mockResolvedValue({ accessKey: validKey, secretKey: validSecret, region: 'us-west-2' });
    api.integrations.saveAwsCredentials.mockResolvedValue({});
    await aws.setup({});
    expect(api.integrations.saveAwsCredentials).toHaveBeenCalledWith({ accessKeyId: validKey, secretAccessKey: validSecret, region: 'us-west-2' });
  });
  it('setup exits on API error', async () => {
    api.integrations.saveAwsCredentials.mockRejectedValue(new Error('denied'));
    await expect(aws.setup({ accessKey: validKey, secretKey: validSecret, region: 'us-east-1' })).rejects.toThrow('process.exit');
  });
  it('status shows configured credentials', async () => {
    api.integrations.getAwsCredentials.mockResolvedValue({ configured: true, accessKeyId: 'AKIA****EXAM', region: 'us-east-1' });
    await aws.status({}, jsonCmd(false));
    expect(output.outputBox).toHaveBeenCalled();
  });
  it('test exits when not configured', async () => {
    api.integrations.getAwsCredentials.mockResolvedValue({ configured: false });
    await expect(aws.test({})).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith('AWS credentials not configured');
  });
  it('test succeeds when configured', async () => {
    api.integrations.getAwsCredentials.mockResolvedValue({ configured: true, accessKeyId: 'AKIA' });
    await aws.test({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('AWS credentials are configured');
  });
  it('remove cancels when user declines', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await aws.remove({});
    expect(api.integrations.deleteAwsCredentials).not.toHaveBeenCalled();
  });
  it('remove deletes when user confirms', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: true });
    api.integrations.deleteAwsCredentials.mockResolvedValue({});
    await aws.remove({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('AWS credentials removed');
  });
});

describe('azure', () => {
  const azure = require('../../src/commands/azure');
  const uuid = '12345678-1234-1234-1234-123456789abc';
  beforeEach(() => jest.clearAllMocks());

  it('setup saves credentials from options', async () => {
    api.integrations.saveAzureCredentials.mockResolvedValue({});
    await azure.setup({ subscriptionId: uuid, tenantId: uuid, clientId: uuid, clientSecret: 'longSecret12', environment: 'public' });
    expect(api.integrations.saveAzureCredentials).toHaveBeenCalledWith(expect.objectContaining({
      authMethod: 'service_principal', subscriptionId: uuid, clientSecret: 'longSecret12',
    }));
  });
  it('setup exits on API error', async () => {
    api.integrations.saveAzureCredentials.mockRejectedValue(new Error('bad'));
    await expect(azure.setup({ subscriptionId: uuid, tenantId: uuid, clientId: uuid, clientSecret: 'longSecret12', environment: 'public' })).rejects.toThrow('process.exit');
  });
  it('status outputs JSON when flag set', async () => {
    const data = { hasCredentials: true, credentials: { subscriptionId: uuid } };
    api.integrations.getAzureCredentials.mockResolvedValue(data);
    await azure.status({}, jsonCmd(true));
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
  it('test exits when not configured', async () => {
    api.integrations.getAzureCredentials.mockResolvedValue({ hasCredentials: false });
    await expect(azure.test({})).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Azure credentials not configured');
  });
  it('test succeeds when configured', async () => {
    api.integrations.getAzureCredentials.mockResolvedValue({ hasCredentials: true });
    await azure.test({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Azure credentials are configured');
  });
  it('remove cancels when declined', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await azure.remove({});
    expect(api.integrations.deleteAzureCredentials).not.toHaveBeenCalled();
  });
  it('remove deletes when confirmed', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: true });
    api.integrations.deleteAzureCredentials.mockResolvedValue({});
    await azure.remove({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Azure credentials removed');
  });
});

describe('gcp', () => {
  const gcp = require('../../src/commands/gcp');
  beforeEach(() => jest.clearAllMocks());

  it('status shows configured credentials', async () => {
    api.integrations.getGcpCredentials.mockResolvedValue({
      hasCredentials: true, credentials: { authMethod: 'service_account', projectId: 'my-proj', clientEmail: 'sa@proj.iam.gserviceaccount.com', hasPrivateKey: true },
    });
    await gcp.status({}, jsonCmd(false));
    expect(output.outputBox).toHaveBeenCalled();
  });
  it('status outputs JSON when flag set', async () => {
    const data = { hasCredentials: true, credentials: { projectId: 'p' } };
    api.integrations.getGcpCredentials.mockResolvedValue(data);
    await gcp.status({}, jsonCmd(true));
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
  it('status exits on error', async () => {
    api.integrations.getGcpCredentials.mockRejectedValue(new Error('err'));
    await expect(gcp.status({}, jsonCmd(false))).rejects.toThrow('process.exit');
  });
  it('test exits when not configured', async () => {
    api.integrations.getGcpCredentials.mockResolvedValue({ hasCredentials: false });
    await expect(gcp.test({})).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith('GCP credentials not configured');
  });
  it('test succeeds when configured', async () => {
    api.integrations.getGcpCredentials.mockResolvedValue({ hasCredentials: true });
    await gcp.test({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('GCP credentials are configured');
  });
  it('remove cancels when declined', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await gcp.remove({});
    expect(api.integrations.deleteGcpCredentials).not.toHaveBeenCalled();
  });
  it('remove deletes when confirmed', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: true });
    api.integrations.deleteGcpCredentials.mockResolvedValue({});
    await gcp.remove({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('GCP credentials removed');
  });
});

describe('ai', () => {
  const ai = require('../../src/commands/ai');
  beforeEach(() => jest.clearAllMocks());

  it('status shows provider info', async () => {
    api.integrations.getAiProvider.mockResolvedValue({ provider: 'anthropic', hasCustomKey: true });
    await ai.status({}, jsonCmd(false));
    expect(output.outputBox).toHaveBeenCalled();
  });
  it('status outputs JSON when flag set', async () => {
    const data = { provider: 'anthropic', hasCustomKey: false };
    api.integrations.getAiProvider.mockResolvedValue(data);
    await ai.status({}, jsonCmd(true));
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
  it('use rejects invalid provider', async () => {
    await expect(ai.use('gemini', {})).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Invalid provider. Choose: anthropic, openai');
  });
  it('use anthropic verifies and saves key', async () => {
    api.integrations.verifyAnthropicKey.mockResolvedValue({});
    api.integrations.saveAnthropicKey.mockResolvedValue({});
    api.integrations.updateAiProvider.mockResolvedValue({});
    await ai.use('anthropic', { key: 'sk-ant-test123' });
    expect(api.integrations.verifyAnthropicKey).toHaveBeenCalledWith('sk-ant-test123');
    expect(api.integrations.saveAnthropicKey).toHaveBeenCalledWith('sk-ant-test123');
    expect(api.integrations.updateAiProvider).toHaveBeenCalledWith({ provider: 'anthropic' });
  });
  it('use openai verifies and saves key', async () => {
    api.integrations.verifyOpenaiKey.mockResolvedValue({});
    api.integrations.saveOpenaiKey.mockResolvedValue({});
    api.integrations.updateAiProvider.mockResolvedValue({});
    await ai.use('openai', { key: 'sk-test123' });
    expect(api.integrations.verifyOpenaiKey).toHaveBeenCalledWith('sk-test123');
    expect(api.integrations.saveOpenaiKey).toHaveBeenCalledWith('sk-test123');
  });
  it('use exits when verification fails', async () => {
    api.integrations.verifyAnthropicKey.mockRejectedValue(new Error('invalid'));
    await expect(ai.use('anthropic', { key: 'sk-ant-bad' })).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid API key');
  });
  it('verify warns when no custom key', async () => {
    api.integrations.getAiProvider.mockResolvedValue({ hasCustomKey: false });
    await ai.verify({});
    expect(mockSpinner.warn).toHaveBeenCalledWith('No custom API key configured');
  });
  it('verify validates stored anthropic key', async () => {
    api.integrations.getAiProvider.mockResolvedValue({ provider: 'anthropic', hasCustomKey: true, apiKey: 'sk-ant-k' });
    api.integrations.verifyAnthropicKey.mockResolvedValue({});
    await ai.verify({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('anthropic API key is valid');
  });
  it('remove cancels when declined', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await ai.remove({});
    expect(api.integrations.getAiProvider).not.toHaveBeenCalled();
  });
  it('remove deletes both keys when confirmed', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: true });
    api.integrations.getAiProvider.mockResolvedValue({ provider: 'anthropic' });
    api.integrations.deleteAnthropicKey.mockResolvedValue({});
    api.integrations.deleteOpenaiKey.mockResolvedValue({});
    await ai.remove({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Custom AI key removed');
  });
});
