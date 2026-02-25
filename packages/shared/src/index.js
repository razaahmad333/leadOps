"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardStatsSchema = exports.FollowUpSchema = exports.CreateFollowUpSchema = exports.LeadSchema = exports.UpdateLeadStatusSchema = exports.CreateLeadSchema = exports.AuthUserSchema = exports.LoginResponseSchema = exports.LoginSchema = exports.Role = exports.LeadStatus = void 0;
// Enums
var enums_1 = require("./enums");
Object.defineProperty(exports, "LeadStatus", { enumerable: true, get: function () { return enums_1.LeadStatus; } });
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return enums_1.Role; } });
// Auth schemas & types
var auth_schema_1 = require("./schemas/auth.schema");
Object.defineProperty(exports, "LoginSchema", { enumerable: true, get: function () { return auth_schema_1.LoginSchema; } });
Object.defineProperty(exports, "LoginResponseSchema", { enumerable: true, get: function () { return auth_schema_1.LoginResponseSchema; } });
Object.defineProperty(exports, "AuthUserSchema", { enumerable: true, get: function () { return auth_schema_1.AuthUserSchema; } });
// Lead schemas & types
var lead_schema_1 = require("./schemas/lead.schema");
Object.defineProperty(exports, "CreateLeadSchema", { enumerable: true, get: function () { return lead_schema_1.CreateLeadSchema; } });
Object.defineProperty(exports, "UpdateLeadStatusSchema", { enumerable: true, get: function () { return lead_schema_1.UpdateLeadStatusSchema; } });
Object.defineProperty(exports, "LeadSchema", { enumerable: true, get: function () { return lead_schema_1.LeadSchema; } });
// FollowUp schemas & types
var followup_schema_1 = require("./schemas/followup.schema");
Object.defineProperty(exports, "CreateFollowUpSchema", { enumerable: true, get: function () { return followup_schema_1.CreateFollowUpSchema; } });
Object.defineProperty(exports, "FollowUpSchema", { enumerable: true, get: function () { return followup_schema_1.FollowUpSchema; } });
// Dashboard schemas & types
var dashboard_schema_1 = require("./schemas/dashboard.schema");
Object.defineProperty(exports, "DashboardStatsSchema", { enumerable: true, get: function () { return dashboard_schema_1.DashboardStatsSchema; } });
//# sourceMappingURL=index.js.map