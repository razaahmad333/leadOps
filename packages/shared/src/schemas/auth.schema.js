"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginResponseSchema = exports.AuthUserSchema = exports.LoginSchema = void 0;
const zod_1 = require("zod");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.AuthUserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string(),
    role: zod_1.z.enum(['OWNER', 'STAFF']),
    tenantId: zod_1.z.string(),
});
exports.LoginResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    user: exports.AuthUserSchema,
});
//# sourceMappingURL=auth.schema.js.map