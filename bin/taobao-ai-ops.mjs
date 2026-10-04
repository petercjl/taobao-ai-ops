#!/usr/bin/env node
import {main} from '../src/cli.mjs';
try { await main(process.argv.slice(2)); }
catch (error) { console.error(JSON.stringify({ok:false,code:error.code||'UNEXPECTED_ERROR',message:error.message,details:error.details})); process.exitCode=1; }
