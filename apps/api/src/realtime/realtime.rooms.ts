export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function branchRoom(tenantId: string, branchId: string): string {
  return `tenant:${tenantId}:branch:${branchId}`;
}

export function leadRoom(leadId: string): string {
  return `lead:${leadId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
