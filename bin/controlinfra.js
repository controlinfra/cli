#!/usr/bin/env node

/**
 * Controlinfra CLI
 * Infrastructure Drift Detection from the command line
 */

const { program } = require('../src/index');

program.parse(process.argv);
