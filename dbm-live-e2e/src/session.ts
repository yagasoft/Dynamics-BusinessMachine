import type {
  LiveE2ECaseDefinition,
  LiveE2EEnvironmentConfig,
  LiveE2ERole,
  LiveE2ESessionMetadata
} from './types.js';

const logicalRoleOrder: LiveE2ERole[] = ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'];

export function assertPersistedUserSessionConfig(environmentConfig: LiveE2EEnvironmentConfig): void {
  const errors = validatePersistedUserSessionConfig(environmentConfig);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

export function validatePersistedUserSessionConfig(environmentConfig: LiveE2EEnvironmentConfig): string[] {
  const errors: string[] = [];
  const authentication = environmentConfig.liveE2E.authentication;

  if (!authentication) {
    errors.push(`Tracked live E2E config for '${environmentConfig.environment}' is missing liveE2E.authentication.`);
    return errors;
  }

  if (authentication.mode !== 'persisted-user-session') {
    errors.push(`Tracked live E2E config for '${environmentConfig.environment}' must use authentication.mode='persisted-user-session'.`);
  }

  if (authentication.sessionScope !== 'environment') {
    errors.push(`Tracked live E2E config for '${environmentConfig.environment}' must use authentication.sessionScope='environment'.`);
  }

  if (authentication.identityModel !== 'single-user-simulation') {
    errors.push(`Tracked live E2E config for '${environmentConfig.environment}' must use authentication.identityModel='single-user-simulation'.`);
  }

  if (!authentication.sessionUserDisplayName || authentication.sessionUserDisplayName.trim().length === 0) {
    errors.push(`Tracked live E2E config for '${environmentConfig.environment}' must declare a non-empty authentication.sessionUserDisplayName.`);
  }

  return errors;
}

export function validateSessionMetadata(
  metadata: LiveE2ESessionMetadata,
  environmentConfig: LiveE2EEnvironmentConfig
): string[] {
  const errors = validatePersistedUserSessionConfig(environmentConfig);

  if (metadata.targetEnvironment !== environmentConfig.environment) {
    errors.push(`Persisted session metadata targets '${metadata.targetEnvironment}' instead of '${environmentConfig.environment}'.`);
  }

  if (metadata.authenticationMode !== 'persisted-user-session') {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' must use authenticationMode='persisted-user-session'.`);
  }

  if (metadata.sessionScope !== 'environment') {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' must use sessionScope='environment'.`);
  }

  if (metadata.identityModel !== 'single-user-simulation' || metadata.physicalUserMode !== 'single-user-simulation') {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' must use the single-user simulation identity model.`);
  }

  if (!metadata.physicalUserDisplayName || metadata.physicalUserDisplayName.trim().length === 0) {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' must include a physicalUserDisplayName.`);
  }

  if (metadata.modelDrivenAppUrl !== environmentConfig.modelDrivenAppUrl) {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' points to a different modelDrivenAppUrl than the tracked config.`);
  }

  if (!isIsoTimestamp(metadata.bootstrapUtc)) {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' has an invalid bootstrapUtc.`);
  }

  for (const [label, value] of [
    ['lastSuccessfulUseUtc', metadata.lastSuccessfulUseUtc],
    ['lastRefreshUtc', metadata.lastRefreshUtc],
    ['lastHealthCheckUtc', metadata.lastHealthCheckUtc]
  ] as const) {
    if (value !== undefined && !isIsoTimestamp(value)) {
      errors.push(`Persisted session metadata for '${environmentConfig.environment}' has an invalid ${label}.`);
    }
  }

  if (!['ready', 'healthy', 'expired', 'invalidated', 'bootstrap-required'].includes(metadata.sessionHealthStatus)) {
    errors.push(`Persisted session metadata for '${environmentConfig.environment}' has an invalid sessionHealthStatus '${metadata.sessionHealthStatus}'.`);
  }

  return errors;
}

export function resolveLogicalRolesExercised(liveCase: LiveE2ECaseDefinition): LiveE2ERole[] {
  const discoveredRoles = new Set<LiveE2ERole>([liveCase.requiredRole]);
  for (const action of liveCase.actions) {
    if (action.role) {
      discoveredRoles.add(action.role);
    }
  }

  return logicalRoleOrder.filter((role) => discoveredRoles.has(role));
}

export function isSessionExpiryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Initialize-LiveDbmE2ESession\.ps1/i.test(message);
}

function isIsoTimestamp(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}
