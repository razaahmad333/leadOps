"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = exports.LeadStatus = void 0;
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "NEW";
    LeadStatus["CONTACTED"] = "CONTACTED";
    LeadStatus["QUALIFIED"] = "QUALIFIED";
    LeadStatus["PENDING"] = "PENDING";
    LeadStatus["WON"] = "WON";
    LeadStatus["LOST"] = "LOST";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
var Role;
(function (Role) {
    Role["OWNER"] = "OWNER";
    Role["STAFF"] = "STAFF";
})(Role || (exports.Role = Role = {}));
//# sourceMappingURL=enums.js.map