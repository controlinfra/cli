/**
 * API Client for Controlinfra — re-export hub
 * Individual modules live in ./api/
 */

const { getClient } = require('./api/client');
const auth = require('./api/auth');
const repos = require('./api/repos');
const scans = require('./api/scans');
const drifts = require('./api/drifts');
const runners = require('./api/runners');
const workspaces = require('./api/workspaces');
const integrations = require('./api/integrations');
const orgs = require('./api/orgs');
const projects = require('./api/projects');
const cliTokens = require('./api/cli-tokens');

module.exports = {
  auth,
  repos,
  scans,
  drifts,
  runners,
  workspaces,
  integrations,
  orgs,
  projects,
  cliTokens,
  getClient,
};
