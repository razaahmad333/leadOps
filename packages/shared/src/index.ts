// Enums
export { LeadStatus, Role } from './enums.js';

// Auth schemas & types
export {
  LoginSchema,
  LoginResponseSchema,
  AuthUserSchema,
  type LoginDto,
  type LoginResponse,
  type AuthUser,
} from './schemas/auth.schema.js';

// Lead schemas & types
export {
  CreateLeadSchema,
  UpdateLeadStatusSchema,
  LeadSchema,
  type CreateLeadDto,
  type UpdateLeadStatusDto,
  type Lead,
} from './schemas/lead.schema.js';

// FollowUp schemas & types
export {
  CreateFollowUpSchema,
  FollowUpSchema,
  type CreateFollowUpDto,
  type FollowUp,
} from './schemas/followup.schema.js';

// Dashboard schemas & types
export {
  DashboardStatsSchema,
  type DashboardStats,
} from './schemas/dashboard.schema.js';
