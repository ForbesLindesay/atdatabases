#! /usr/bin/env node

// Using sucrase lets people write migrations using TypeScript
import 'sucrase/register';
import {getCommandLineInterface} from '@databases/migrations-base';
import PostgresCommandLineConfig from './PostgresCommandLineConfig';

getCommandLineInterface(PostgresCommandLineConfig)(process.argv.slice(2));
