'use strict';

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  integrations: {
    updateSlack: vi.fn(), testSlack: vi.fn(), getSlack: vi.fn(), deleteSlack: vi.fn(),
    saveAwsCredentials: vi.fn(), getAwsCredentials: vi.fn(), deleteAwsCredentials: vi.fn(),
    saveAzureCredentials: vi.fn(), getAzureCredentials: vi.fn(), deleteAzureCredentials: vi.fn(),
    saveGcpCredentials: vi.fn(), getGcpCredentials: vi.fn(), deleteGcpCredentials: vi.fn(),
    getAiProvider: vi.fn(), updateAiProvider: vi.fn(),
    verifyAnthropicKey: vi.fn(), saveAnthropicKey: vi.fn(), deleteAnthropicKey: vi.fn(),
    verifyOpenaiKey: vi.fn(), saveOpenaiKey: vi.fn(), deleteOpenaiKey: vi.fn(),
  },
}));
vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()), requireAuth: vi.fn(), saveAuth: vi.fn(), getUser: vi.fn(), isAuthenticated: vi.fn() }));
// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: { start: vi.fn().mockReturnThis(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() } }));
vi.mock('../../src/output', async (importOriginal) => ({
  ...(await importOriginal()),
  brand: { purple: vi.fn((s) => s), purpleBold: vi.fn((s) => s), mid: vi.fn((s) => s), light: vi.fn((s) => s), cyan: vi.fn((s) => s), cyanBold: vi.fn((s) => s), gradient: Array(6).fill(vi.fn((s) => s)) },
  createSpinner: vi.fn(() => mockSpinner),
  outputError: vi.fn(), outputInfo: vi.fn(), outputTable: vi.fn(), outputBox: vi.fn(), formatRelativeTime: vi.fn((d) => d),
}));
vi.mock('inquirer', () => ({ default: { prompt: vi.fn() }, prompt: vi.fn() }));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  const mocked = { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() };
  // source files do `import fs from 'fs'`, so the default matters
  return { ...mocked, default: mocked };
});

import * as api from '../../src/api.js';
import * as output from '../../src/output.js';
import inquirer from 'inquirer';
import * as slack from '../../src/commands/slack.js';
import * as aws from '../../src/commands/aws.js';
import * as azure from '../../src/commands/azure.js';
import * as gcp from '../../src/commands/gcp.js';
import * as ai from '../../src/commands/ai.js';
beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const jsonCmd = (json) => ({ parent: { parent: { opts: () => ({ json }) } } });

describe('slack', () => {
  beforeEach(() => vi.clearAllMocks());

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
  const validKey = 'AKIAIOSFODNN7EXAM';
  const validSecret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  beforeEach(() => vi.clearAllMocks());

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
  const uuid = '12345678-1234-1234-1234-123456789abc';
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  it('verify reports configured state without round-tripping the saved key', async () => {
    // After the audit fix, `ai verify` no longer tries to re-verify the
    // stored key against the provider — the server doesn't return key
    // material (correctly), so passing `data.apiKey` to verifyAnthropicKey
    // was sending `undefined` and printing a misleading failure.
    api.integrations.getAiProvider.mockResolvedValue({ provider: 'anthropic', hasCustomKey: true });
    await ai.verify({});
    expect(mockSpinner.succeed).toHaveBeenCalledWith('anthropic API key is configured');
    expect(api.integrations.verifyAnthropicKey).not.toHaveBeenCalled();
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
