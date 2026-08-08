#!/usr/bin/env node

/**
 * Controlinfra CLI
 * Infrastructure Drift Detection from the command line
 */

import { program } from '../src/index.js';

program.parse(process.argv);
