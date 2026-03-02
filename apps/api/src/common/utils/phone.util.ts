export function normalizePhoneNumber(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

export function samePhoneNumber(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizePhoneNumber(left);
  const normalizedRight = normalizePhoneNumber(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}
