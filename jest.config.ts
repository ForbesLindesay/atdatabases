import type {Config} from 'jest';
import {createDefaultEsmPreset} from 'ts-jest';

const presetConfig = createDefaultEsmPreset({
  //...options
});
const config: Config = {
  projects: [
    {
      displayName: 'node',
      testRegex: '/__tests__/.+\\.test\\.(tsx?)$',
      ...presetConfig,
    },
    {
      displayName: 'pg',
      testRegex: '/__tests__/.+\\.test\\.pg\\.(tsx?)$',
      globalSetup: './packages/pg-test/dist/jest/globalSetup.js',
      globalTeardown: './packages/pg-test/dist/jest/globalTeardown.js',
      ...presetConfig,
    },
    {
      displayName: 'mysql',
      testRegex: '/__tests__/.+\\.test\\.mysql\\.(tsx?)$',
      globalSetup: './packages/mysql-test/dist/jest/globalSetup.js',
      globalTeardown: './packages/mysql-test/dist/jest/globalTeardown.js',
      ...presetConfig,
    },
    {
      displayName: 'bigquery',
      testEnvironment: 'node',
      testRegex: '/__tests__/.+\\.test\\.bigquery\\.(tsx?)$',
      ...presetConfig,
    },
  ],
};
export default config;
