import type { IndustryPreset } from '@leadops/shared';

export function industryPresetLabel(preset?: IndustryPreset | string | null): string {
  switch (preset) {
    case 'DIAGNOSTICS_LAB':
      return 'Diagnostics Lab';
    case 'COSMETIC_CLINIC':
      return 'Cosmetic Clinic';
    case 'DENTAL_CLINIC':
      return 'Dental Clinic';
    case 'DOCTOR_OPD_CLINIC':
      return 'Doctor OPD Clinic';
    case 'GENERIC':
    default:
      return 'Generic';
  }
}
