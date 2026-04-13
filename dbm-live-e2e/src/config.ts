import path from 'node:path';

import { loadEnvironmentConfig } from './case-loader.js';
import { assertPersistedUserSessionConfig } from './session.js';
import type { LiveE2EEnvironmentConfig } from './types.js';

export function resolveEnvironmentConfigPath(repoRoot: string, environmentName: 'Dev' | 'UAT' | 'Prod'): string {
  return path.join(repoRoot, 'azure', 'config', `${environmentName.toLowerCase()}.json`);
}

export function readTrackedEnvironmentConfig(repoRoot: string, environmentName: 'Dev' | 'UAT' | 'Prod'): LiveE2EEnvironmentConfig {
  const config = loadEnvironmentConfig(resolveEnvironmentConfigPath(repoRoot, environmentName));
  assertPersistedUserSessionConfig(config);
  return config;
}

export function resolveTrackedSessionDisplayName(config: LiveE2EEnvironmentConfig): string {
  assertPersistedUserSessionConfig(config);
  return config.liveE2E.authentication.sessionUserDisplayName;
}
