"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadSchema = exports.UpdateLeadStatusSchema = exports.CreateLeadSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../enums.js");
exports.CreateLeadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(200),
    phone: zod_1.z.string().max(30).optional(),
    email: zod_1.z.string().email('Invalid email').optional(),
    source: zod_1.z.string().max(100).optional(),
});
exports.UpdateLeadStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(enums_js_1.LeadStatus),
});
exports.LeadSchema = zod_1.z.object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    name: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    source: zod_1.z.string().nullable(),
    status: zod_1.z.nativeEnum(enums_js_1.LeadStatus),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
//# sourceMappingURL=lead.schema.js.map