export function normalizeRoles(roles: string[] | undefined): string[] {
  return (roles ?? [])
    .map((role) => role.trim().toLowerCase())
    .filter((role, index, list) => role.length > 0 && list.indexOf(role) === index);
}

export function hasAdminRole(roles: string[] | undefined): boolean {
  return normalizeRoles(roles).includes('admin');
}
