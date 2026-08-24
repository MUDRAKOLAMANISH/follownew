import { User } from 'firebase/auth';

// Strict list of authorized Super Admin / Application Owner emails
export const SUPER_ADMIN_EMAILS = [
  'manishmudrakola8@gmail.com',
  'admin@followflow.ai',
  'admin@leadpilot.ai',
  'owner@followflow.ai'
];

/**
 * Strictly checks if the current user is the Super Admin / Application Owner.
 * Regular users and business owners return FALSE.
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  
  const email = (user.email || '').toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return true;
  }

  // Exact owner or admin prefixes on the followflow.ai / leadpilot.ai domains
  if (email.endsWith('@followflow.ai') && (email.startsWith('admin@') || email.startsWith('owner@'))) {
    return true;
  }

  // Developer simulation flag (only if explicitly set in local storage)
  const localAdminOverride = typeof window !== 'undefined' ? localStorage.getItem('followflow_super_admin_mode') : null;
  if (localAdminOverride === 'true') {
    return true;
  }

  // Regular business owners / users are NOT super admins
  return false;
}

/**
 * Alias for isSuperAdmin to maintain backward compatibility
 */
export function isUserAdmin(user: User | null | undefined): boolean {
  return isSuperAdmin(user);
}

/**
 * Returns user display role
 */
export function getUserRole(user: User | null | undefined): 'Super Admin' | 'Business Owner' | 'Guest' {
  if (isSuperAdmin(user)) return 'Super Admin';
  if (user) return 'Business Owner';
  return 'Guest';
}

