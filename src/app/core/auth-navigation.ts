import type { User } from './models';

export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/home';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\r\n]/.test(decoded)) return '/home';
  } catch { return '/home'; }
  if (/^\/(login|signup|auth|email-otp|complete-profile)(?:[/?#]|$)/.test(value)) return '/home';
  return value;
}

export function needsProfile(user: User): boolean {
  return !user.firstName.trim() || !user.lastName.trim() || !user.phone.trim();
}

/** The admin app keeps its own saved login, so a shop admin's token is handed over before opening it. */
export function openAdminApp(token: string | null): boolean {
  if (!token || typeof window === 'undefined') return false;
  try {
    localStorage.setItem('scentop-admin-token', token);
  } catch {
    return false;
  }
  window.location.assign('/admin/');
  return true;
}
