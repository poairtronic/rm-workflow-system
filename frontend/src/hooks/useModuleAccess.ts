import { useAuth } from '../contexts/AuthContext';

export interface ModuleAccess {
  hasAccess: boolean;  // true if FULL_ACCESS or VIEW (not DENY)
  canEdit: boolean;    // true if FULL_ACCESS (or ADMIN)
  isReadOnly: boolean; // true if VIEW
  tier: 'FULL_ACCESS' | 'VIEW' | 'DENY';
}

export function useModuleAccess(moduleKey?: string): ModuleAccess {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return { hasAccess: false, canEdit: false, isReadOnly: true, tier: 'DENY' };
  }

  if (currentUser.role === 'ADMIN') {
    return { hasAccess: true, canEdit: true, isReadOnly: false, tier: 'FULL_ACCESS' };
  }

  if (!moduleKey) {
    return { hasAccess: true, canEdit: true, isReadOnly: false, tier: 'FULL_ACCESS' };
  }

  const explicit = currentUser.permissionsMap?.[moduleKey];
  if (explicit === 'DENY') {
    return { hasAccess: false, canEdit: false, isReadOnly: true, tier: 'DENY' };
  }
  if (explicit === 'VIEW') {
    return { hasAccess: true, canEdit: false, isReadOnly: true, tier: 'VIEW' };
  }
  if (explicit === 'FULL_ACCESS') {
    return { hasAccess: true, canEdit: true, isReadOnly: false, tier: 'FULL_ACCESS' };
  }

  // Fallback to effectiveModules
  const allowed = currentUser.effectiveModules?.includes(moduleKey) ?? false;
  return {
    hasAccess: allowed,
    canEdit: allowed,
    isReadOnly: !allowed,
    tier: allowed ? 'FULL_ACCESS' : 'DENY',
  };
}

