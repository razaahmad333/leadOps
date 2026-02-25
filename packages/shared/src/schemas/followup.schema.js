"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpSchema = exports.CreateFollowUpSchema = void 0;
const zod_1 = require("zod");
exports.CreateFollowUpSchema = zod_1.z.object({
    leadId: zod_1.z.string().min(1, 'leadId is required'),
    scheduledAt: zod_1.z.coerce.date(),
    note: zod_1.z.string().max(1000).optional(),
});
exports.FollowUpSchema = zod_1.z.object({
    id: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    leadId: zod_1.z.string(),
    scheduledAt: zod_1.z.coerce.date(),
    note: zod_1.z.string().nullable(),
    done: zod_1.z.boolean(),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
//# sourceMappingURL=followup.schema.js.map