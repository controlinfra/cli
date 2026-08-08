/**
 * API Client for Controlinfra — re-export hub
 * Individual modules live in ./api/
 */

import { getClient } from './api/client.js';
import auth from './api/auth.js';
import repos from './api/repos.js';
import scans from './api/scans.js';
import drifts from './api/drifts.js';
import runners from './api/runners.js';
import workspaces from './api/workspaces.js';
import integrations from './api/integrations.js';
import orgs from './api/orgs.js';
import projects from './api/projects.js';
import cliTokens from './api/cli-tokens.js';

export { auth, repos, scans, drifts, runners, workspaces, integrations, orgs, projects, cliTokens, getClient };