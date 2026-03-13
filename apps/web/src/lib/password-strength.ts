export type PasswordStrengthLevel = 'Weak' | 'Medium' | 'Strong';

export interface PasswordStrengthEvaluation {
  meetsMinLength: boolean;
  meetsRecommendedLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  level: PasswordStrengthLevel;
}

const LOWERCASE_REGEX = /[a-z]/;
const UPPERCASE_REGEX = /[A-Z]/;
const NUMBER_REGEX = /\d/;
const SYMBOL_REGEX = /[^A-Za-z0-9]/;

export function evaluatePasswordStrength(password: string): PasswordStrengthEvaluation {
  const value = password ?? '';
  const meetsMinLength = value.length >= 8;
  const meetsRecommendedLength = value.length >= 12;
  const hasLower = LOWERCASE_REGEX.test(value);
  const hasUpper = UPPERCASE_REGEX.test(value);
  const hasNumber = NUMBER_REGEX.test(value);
  const hasSymbol = SYMBOL_REGEX.test(value);

  const requirementCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  let level: PasswordStrengthLevel = 'Weak';
  if (meetsMinLength && requirementCount >= 3) {
    level = 'Medium';
  }

  if (meetsMinLength && meetsRecommendedLength && requirementCount === 4) {
    level = 'Strong';
  }

  return {
    meetsMinLength,
    meetsRecommendedLength,
    hasLower,
    hasUpper,
    hasNumber,
    hasSymbol,
    level,
  };
}
