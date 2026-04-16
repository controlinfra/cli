'use strict';

jest.mock('../../src/api', () => ({
  scans: { retry: jest.fn(), delete: jest.fn(), list: jest.fn(), getByRepository: jest.fn(),
    trigger: jest.fn(), cancel: jest.fn(), getDetails: jest.fn() },
  repos: { list: jest.fn() },
  drifts: { list: jest.fn(), get: jest.fn(), getByScan: jest.fn(), getByRepository: jest.fn(),
    generateFix: jest.fn(), createPR: jest.fn(), updateStatus: jest.fn(),
    getStatistics: jest.fn(), reanalyze: jest.fn() },
}));

jest.mock('../../src/config', () => ({
  requireAuth: jest.fn(),
  getDriftGateDefaults: jest.fn(() => ({})),
}));

const mockSpinner = {
  start: jest.fn().mockReturnThis(), stop: jest.fn(), succeed: jest.fn(),
  fail: jest.fn(), warn: jest.fn(),
};
jest.mock('../../src/output', () => ({
  brand: { purple: jest.fn((s) => s), purpleBold: jest.fn((s) => s), mid: jest.fn((s) => s),
    light: jest.fn((s) => s), cyan: jest.fn((s) => s), cyanBold: jest.fn((s) => s),
    gradient: Array(6).fill(jest.fn((s) => s)) },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(), outputTable: jest.fn(), outputInfo: jest.fn(),
  outputBox: jest.fn(), colorStatus: jest.fn((s) => s),
  formatRelativeTime: jest.fn(() => '1m ago'), formatDuration: jest.fn(() => '5s'),
  truncate: jest.fn((s) => s),
}));

jest.mock('../../src/commands/scan-wait', () => ({
  resolveScanId: jest.fn((id) => Promise.resolve(id)),
  getGlobalJsonFlag: jest.fn(() => false),
  waitForScan: jest.fn(),
}));

jest.mock('inquirer', () => ({ prompt: jest.fn() }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), writeFileSync: jest.fn() }));

const api = require('../../src/api');
const output = require('../../src/output');
const inquirer = require('inquirer');
const fs = require('fs');
const { resolveScanId, getGlobalJsonFlag } = require('../../src/commands/scan-wait');
const { retry, deleteScan } = require('../../src/commands/scan-actions');
const { run, list: scanList, cancel, logs } = require('../../src/commands/scan');
const { list: driftList, show, fix, createPR, ignore, resolve } = require('../../src/commands/drifts');
const { stats, reanalyze, exportDrifts } = require('../../src/commands/drifts-actions');

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

beforeEach(() => jest.clearAllMocks());

// --- scan-actions.js ---

describe('retry', () => {
  it('should retry scan and display new ID', async () => {
    api.scans.retry.mockResolvedValue({ scanId: 'new-scan-123' });
    await retry('scan-1');
    expect(api.scans.retry).toHaveBeenCalledWith('scan-1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('new-scan-123'));
  });

  it('should exit 1 on API error', async () => {
    api.scans.retry.mockRejectedValue(new Error('server error'));
    await expect(retry('scan-1')).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('server error');
  });

  it('should exit 1 when scan not found', async () => {
    resolveScanId.mockResolvedValueOnce(null);
    await expect(retry('bad-id')).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Scan not found');
  });
});

describe('deleteScan', () => {
  it('should delete with --force without prompting', async () => {
    api.scans.delete.mockResolvedValue({});
    await deleteScan('scan-1', { force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.scans.delete).toHaveBeenCalledWith('scan-1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Scan deleted successfully');
  });

  it('should prompt for confirmation and abort on decline', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await deleteScan('scan-1', {});
    expect(api.scans.delete).not.toHaveBeenCalled();
  });

  it('should exit 1 on API error', async () => {
    api.scans.delete.mockRejectedValue(new Error('forbidden'));
    await expect(deleteScan('scan-1', { force: true })).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('forbidden');
  });
});

// --- scan.js ---

describe('scan run', () => {
  it('should trigger scan for matching repo', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'rc1', repository: { fullName: 'org/repo' } }] });
    api.scans.trigger.mockResolvedValue({ scanId: 'scan-abc' });
    await run('org/repo', {}, null);
    expect(api.scans.trigger).toHaveBeenCalledWith('rc1', { runnerId: undefined });
    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('scan-abc'));
  });

  it('should exit 1 when repo not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    await expect(run('org/missing', {}, null)).rejects.toThrow('process.exit');
    expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('should exit 1 on trigger error', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'rc1', repository: { fullName: 'org/repo' } }] });
    api.scans.trigger.mockRejectedValue(new Error('quota exceeded'));
    await expect(run('org/repo', {}, null)).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('quota exceeded');
  });
});

describe('scan list', () => {
  it('should list scans', async () => {
    api.scans.list.mockResolvedValue({ scans: [{ _id: 'scan1', status: 'completed' }] });
    await scanList({}, null);
    expect(output.outputTable).toHaveBeenCalled();
  });

  it('should use getByRepository when --repo', async () => {
    api.scans.getByRepository.mockResolvedValue({ scans: [] });
    await scanList({ repo: 'repo-id' }, null);
    expect(api.scans.getByRepository).toHaveBeenCalledWith('repo-id', expect.any(Object));
  });

  it('should exit 1 on error', async () => {
    api.scans.list.mockRejectedValue(new Error('fail'));
    await expect(scanList({}, null)).rejects.toThrow('process.exit');
  });
});

describe('scan cancel', () => {
  it('should cancel a scan', async () => {
    api.scans.cancel.mockResolvedValue({});
    await cancel('scan-1');
    expect(api.scans.cancel).toHaveBeenCalledWith('scan-1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Scan cancelled');
  });

  it('should exit 1 on error', async () => {
    api.scans.cancel.mockRejectedValue(new Error('not running'));
    await expect(cancel('scan-1')).rejects.toThrow('process.exit');
  });
});

describe('scan logs', () => {
  it('should display scan details', async () => {
    api.scans.getDetails.mockResolvedValue({ scan: { _id: 's1', planOutput: 'plan text', timing: {} } });
    await logs('s1', {});
    expect(api.scans.getDetails).toHaveBeenCalledWith('s1');
    expect(mockSpinner.stop).toHaveBeenCalled();
  });

  it('should exit 1 on error', async () => {
    api.scans.getDetails.mockRejectedValue(new Error('not found'));
    await expect(logs('s1', {})).rejects.toThrow('process.exit');
  });
});

// --- drifts.js ---

describe('drifts list', () => {
  it('should list all drifts', async () => {
    api.drifts.list.mockResolvedValue({ drifts: [{ _id: 'd1', severity: 'high' }] });
    await driftList({}, null);
    expect(output.outputTable).toHaveBeenCalled();
  });

  it('should use getByScan when --scan', async () => {
    api.drifts.getByScan.mockResolvedValue({ drifts: [] });
    await driftList({ scan: 'scan-1' }, null);
    expect(api.drifts.getByScan).toHaveBeenCalledWith('scan-1');
  });

  it('should use getByRepository when --repo', async () => {
    api.drifts.getByRepository.mockResolvedValue({ drifts: [] });
    await driftList({ repo: 'repo-1' }, null);
    expect(api.drifts.getByRepository).toHaveBeenCalledWith('repo-1');
  });

  it('should exit 1 on error', async () => {
    api.drifts.list.mockRejectedValue(new Error('fail'));
    await expect(driftList({}, null)).rejects.toThrow('process.exit');
  });
});

describe('drifts show', () => {
  it('should display drift details', async () => {
    api.drifts.get.mockResolvedValue({ drift: { _id: 'd1', resource: { address: 'aws_s3.b' }, changes: [] } });
    await show('d1', {}, null);
    expect(api.drifts.get).toHaveBeenCalledWith('d1');
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('should exit 1 on error', async () => {
    api.drifts.get.mockRejectedValue(new Error('not found'));
    await expect(show('d1', {}, null)).rejects.toThrow('process.exit');
  });
});

describe('drifts fix', () => {
  it('should generate fix', async () => {
    api.drifts.generateFix.mockResolvedValue({ drift: { fixCode: 'resource {}' } });
    await fix('d1', {}, null);
    expect(api.drifts.generateFix).toHaveBeenCalledWith('d1', { provider: undefined });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Fix generated successfully');
  });

  it('should exit 1 on error', async () => {
    api.drifts.generateFix.mockRejectedValue(new Error('ai error'));
    await expect(fix('d1', {}, null)).rejects.toThrow('process.exit');
  });
});

describe('drifts createPR', () => {
  it('should create PR', async () => {
    api.drifts.createPR.mockResolvedValue({ pullRequest: { url: 'https://github.com/pr/1' } });
    await createPR('d1', {}, null);
    expect(api.drifts.createPR).toHaveBeenCalledWith('d1', { autoMerge: undefined });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Pull request created');
  });

  it('should exit 1 on error', async () => {
    api.drifts.createPR.mockRejectedValue(new Error('no fix'));
    await expect(createPR('d1', {}, null)).rejects.toThrow('process.exit');
  });
});

describe('drifts ignore', () => {
  it('should mark drift as ignored', async () => {
    api.drifts.updateStatus.mockResolvedValue({});
    await ignore('d1');
    expect(api.drifts.updateStatus).toHaveBeenCalledWith('d1', 'ignored');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Drift marked as ignored');
  });

  it('should exit 1 on error', async () => {
    api.drifts.updateStatus.mockRejectedValue(new Error('fail'));
    await expect(ignore('d1')).rejects.toThrow('process.exit');
  });
});

describe('drifts resolve', () => {
  it('should mark drift as resolved', async () => {
    api.drifts.updateStatus.mockResolvedValue({});
    await resolve('d1');
    expect(api.drifts.updateStatus).toHaveBeenCalledWith('d1', 'resolved');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Drift marked as resolved');
  });

  it('should exit 1 on error', async () => {
    api.drifts.updateStatus.mockRejectedValue(new Error('fail'));
    await expect(resolve('d1')).rejects.toThrow('process.exit');
  });
});

// --- drifts-actions.js ---

describe('stats', () => {
  it('should show statistics with --repo', async () => {
    api.drifts.getStatistics.mockResolvedValue({ total: 5, bySeverity: {}, byStatus: {} });
    await stats({ repo: 'repo-1' }, null);
    expect(api.drifts.getStatistics).toHaveBeenCalledWith('repo-1');
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('should aggregate from list when no --repo', async () => {
    api.drifts.list.mockResolvedValue({ drifts: [{ severity: 'high', status: 'detected' }] });
    await stats({}, null);
    expect(api.drifts.list).toHaveBeenCalledWith({ limit: 1000 });
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('should exit 1 on error', async () => {
    api.drifts.list.mockRejectedValue(new Error('fail'));
    await expect(stats({}, null)).rejects.toThrow('process.exit');
  });
});

describe('reanalyze', () => {
  it('should reanalyze drift', async () => {
    api.drifts.reanalyze.mockResolvedValue({ drift: { aiAnalysis: { summary: 'ok' } } });
    await reanalyze('d1');
    expect(api.drifts.reanalyze).toHaveBeenCalledWith('d1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Drift reanalysis started');
  });

  it('should exit 1 on error', async () => {
    api.drifts.reanalyze.mockRejectedValue(new Error('fail'));
    await expect(reanalyze('d1')).rejects.toThrow('process.exit');
  });
});

describe('exportDrifts', () => {
  it('should write to file when --output specified', async () => {
    api.drifts.list.mockResolvedValue({ drifts: [{ _id: 'd1' }] });
    await exportDrifts({ output: '/tmp/drifts.json' });
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/drifts.json', expect.any(String), 'utf8');
  });

  it('should print to stdout when no --output', async () => {
    api.drifts.list.mockResolvedValue({ drifts: [{ _id: 'd1' }] });
    await exportDrifts({});
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  it('should exit 1 on error', async () => {
    api.drifts.list.mockRejectedValue(new Error('fail'));
    await expect(exportDrifts({})).rejects.toThrow('process.exit');
  });
});
