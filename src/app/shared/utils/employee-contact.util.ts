export type EmployeeContactMissing =
  | 'name'
  | 'email'
  | 'emailVerified'
  | 'phone'
  | 'phoneVerified';

export interface EmployeeContactProfile {
  userName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  userPhone?: string | null;
  phoneVerified?: boolean | null;
}

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function hasEmployeeName(name?: string | null): boolean {
  return (name?.trim().length ?? 0) >= 2;
}

export function isValidEmployeeEmail(email?: string | null): boolean {
  const trimmed = email?.trim() ?? '';
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

/** Indian mobile: 10 digits starting 6–9, optional +91 / 91 / 0. */
export function isValidEmployeePhone(phone?: string | null): boolean {
  if (!phone?.trim()) {
    return false;
  }
  let digits = phone.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits);
}

export function missingEmployeeContactRequirements(
  profile: EmployeeContactProfile | null | undefined,
): EmployeeContactMissing[] {
  const missing: EmployeeContactMissing[] = [];
  if (!hasEmployeeName(profile?.userName)) {
    missing.push('name');
  }
  if (!isValidEmployeeEmail(profile?.email)) {
    missing.push('email');
  } else if (profile?.emailVerified !== true) {
    missing.push('emailVerified');
  }
  if (!isValidEmployeePhone(profile?.userPhone)) {
    missing.push('phone');
  } else if (profile?.phoneVerified !== true) {
    missing.push('phoneVerified');
  }
  return missing;
}

export function needsContactVerification(
  profile: EmployeeContactProfile | null | undefined,
): boolean {
  return missingEmployeeContactRequirements(profile).some(
    (item) => item === 'emailVerified' || item === 'phone' || item === 'phoneVerified' || item === 'email',
  );
}
