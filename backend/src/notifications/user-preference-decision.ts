export type PreferenceSource =
  | 'OVERRIDE_ON'
  | 'OVERRIDE_OFF'
  | 'LEGACY_USER_OFF'
  | 'ROLE_ON'
  | 'ROLE_OFF';

export interface EvaluateUserPreferenceParams {
  overrideState?: 'ON' | 'OFF' | 'INHERIT' | string | null;
  legacyEmailOff: boolean;
  roleEnabled: boolean;
}

export interface UserPreferenceDecision {
  effective: boolean;
  source: PreferenceSource;
}

/**
 * Pure evaluation function for user email notification preference.
 * Deterministic evaluation order:
 * 1. Explicit user override ON -> effective: true, source: OVERRIDE_ON
 * 2. Explicit user override OFF -> effective: false, source: OVERRIDE_OFF
 * 3. Legacy user preference (workflow_email_enabled = false) -> effective: false, source: LEGACY_USER_OFF
 * 4. Role setting enabled -> effective: true, source: ROLE_ON
 * 5. Role setting disabled -> effective: false, source: ROLE_OFF
 */
export function evaluateUserPreference(
  params: EvaluateUserPreferenceParams,
): UserPreferenceDecision {
  if (params.overrideState === 'ON') {
    return { effective: true, source: 'OVERRIDE_ON' };
  }
  if (params.overrideState === 'OFF') {
    return { effective: false, source: 'OVERRIDE_OFF' };
  }
  if (params.legacyEmailOff) {
    return { effective: false, source: 'LEGACY_USER_OFF' };
  }
  if (params.roleEnabled) {
    return { effective: true, source: 'ROLE_ON' };
  }
  return { effective: false, source: 'ROLE_OFF' };
}
