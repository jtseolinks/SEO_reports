// Shared password policy. Imported by BOTH server routes and client forms so the
// rule that decides "strong enough" is identical everywhere a password is chosen
// (register, onboarding, invite-accept, password reset, member setup).

export const PASSWORD_MIN_LENGTH = 8;

// A small blocklist of obviously-weak passwords. Not exhaustive — the structural
// rules below catch most weak inputs; this just rejects the worst offenders.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "passw0rd", "123456", "1234567", "12345678",
  "123456789", "1234567890", "0123456789", "qwerty", "qwerty123", "abc123",
  "111111", "123123", "admin", "admin123", "letmein", "iloveyou", "welcome",
  "monkey", "1q2w3e4r", "qwertyuiop", "aaaaaaaa",
]);

// Returns a Hebrew error message when the password is too weak, or null when it
// satisfies the policy.
export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < PASSWORD_MIN_LENGTH)
    return `הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN_LENGTH} תווים`;
  if (!/[a-z]/.test(pw)) return "הסיסמה חייבת לכלול אות קטנה באנגלית (a-z)";
  if (!/[A-Z]/.test(pw)) return "הסיסמה חייבת לכלול אות גדולה באנגלית (A-Z)";
  if (!/[0-9]/.test(pw)) return "הסיסמה חייבת לכלול ספרה (0-9)";
  if (COMMON_PASSWORDS.has(pw.toLowerCase()))
    return "הסיסמה נפוצה מדי — בחר סיסמה ייחודית";
  if (/^(.)\1+$/.test(pw)) return "הסיסמה חלשה מדי — תו אחד חוזר";
  if (isSequentialRun(pw.toLowerCase()))
    return "הסיסמה חלשה מדי — רצף תווים עוקבים";
  return null;
}

export function isPasswordValid(pw: string): boolean {
  return validatePassword(pw) === null;
}

// True when the whole string is one ascending or descending run of adjacent
// characters, e.g. "012345", "abcdef", "98765432".
function isSequentialRun(s: string): boolean {
  if (s.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < s.length; i++) {
    const delta = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}
