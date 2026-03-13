export interface TimezoneOption {
  value: string;
  label: string;
}

const CURATED_TIMEZONES: TimezoneOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'India Standard Time' },
  { value: 'Asia/Jakarta', label: 'Western Indonesia Time' },
  { value: 'Asia/Singapore', label: 'Singapore Time' },
  { value: 'Asia/Bangkok', label: 'Indochina Time' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia Time' },
  { value: 'Asia/Manila', label: 'Philippines Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time' },
  { value: 'Asia/Shanghai', label: 'China Standard Time' },
  { value: 'Australia/Perth', label: 'Australian Western Time' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time' },
  { value: 'Europe/London', label: 'United Kingdom Time' },
  { value: 'Europe/Dublin', label: 'Ireland Time' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Europe/Berlin', label: 'Germany Time' },
  { value: 'Europe/Amsterdam', label: 'Netherlands Time' },
  { value: 'Europe/Madrid', label: 'Spain Time' },
  { value: 'Europe/Rome', label: 'Italy Time' },
  { value: 'Europe/Zurich', label: 'Switzerland Time' },
  { value: 'Europe/Warsaw', label: 'Poland Time' },
  { value: 'Europe/Moscow', label: 'Moscow Time' },
  { value: 'Africa/Johannesburg', label: 'South Africa Time' },
  { value: 'Africa/Cairo', label: 'Egypt Time' },
  { value: 'America/New_York', label: 'US Eastern Time' },
  { value: 'America/Chicago', label: 'US Central Time' },
  { value: 'America/Denver', label: 'US Mountain Time' },
  { value: 'America/Los_Angeles', label: 'US Pacific Time' },
  { value: 'America/Phoenix', label: 'US Arizona Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'America/Toronto', label: 'Canada Eastern Time' },
  { value: 'America/Vancouver', label: 'Canada Pacific Time' },
  { value: 'America/Mexico_City', label: 'Mexico Central Time' },
  { value: 'America/Bogota', label: 'Colombia Time' },
  { value: 'America/Lima', label: 'Peru Time' },
  { value: 'America/Santiago', label: 'Chile Time' },
  { value: 'America/Sao_Paulo', label: 'Brazil Time' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeTimezoneValue(value: string): string {
  return value.trim();
}

export function buildTimezoneOptions(currentValue?: string): TimezoneOption[] {
  const current = normalizeTimezoneValue(currentValue ?? '');
  const options = [...CURATED_TIMEZONES];

  if (current && !options.some((option) => option.value === current)) {
    options.unshift({
      value: current,
      label: `Current: ${current}`,
    });
  }

  return options;
}

export function filterTimezoneOptions(
  options: TimezoneOption[],
  search: string,
  selectedValue?: string,
): TimezoneOption[] {
  const normalizedSearch = search.trim().toLowerCase();
  const selected = normalizeTimezoneValue(selectedValue ?? '');

  const filtered = normalizedSearch.length === 0
    ? options
    : options.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(normalizedSearch));

  if (!selected) {
    return filtered;
  }

  if (filtered.some((option) => option.value === selected)) {
    return filtered;
  }

  const selectedOption = options.find((option) => option.value === selected);
  return selectedOption ? [selectedOption, ...filtered] : filtered;
}

export function isTimezoneSelectionValid(value: string, options: TimezoneOption[]): boolean {
  const normalized = normalizeTimezoneValue(value);
  return normalized.length > 0 && options.some((option) => option.value === normalized);
}

export function isValidBusinessTimeRange(start: string, end: string): boolean {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return false;
  }

  const [startHour, startMinute] = start.split(':').map((part) => Number.parseInt(part, 10));
  const [endHour, endMinute] = end.split(':').map((part) => Number.parseInt(part, 10));
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return startTotal < endTotal;
}
