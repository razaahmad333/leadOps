"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardStatsSchema = void 0;
const zod_1 = require("zod");
exports.DashboardStatsSchema = zod_1.z.object({
    new: zod_1.z.number().int().nonnegative(),
    contacted: zod_1.z.number().int().nonnegative(),
    pending: zod_1.z.number().int().nonnegative(),
    won: zod_1.z.number().int().nonnegative(),
    lost: zod_1.z.number().int().nonnegative(),
    todayFollowups: zod_1.z.number().int().nonnegative(),
});
//# sourceMappingURL=dashboard.schema.js.map