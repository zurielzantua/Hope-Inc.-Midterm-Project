export const ERP_MODULES = [
  { code: 'customer', slug: 'customer', href: '/erp/modules/customer', name: 'Customer Management', description: 'Customer records and related actions.' },
  { code: 'product', slug: 'product', href: '/erp/modules/product', name: 'Product Management', description: 'Products and pricing.' },
  { code: 'human_resources', slug: 'human-resources', href: '/erp/modules/human-resources', name: 'Human Resources', description: 'Employees, departments, jobs, and history.' },
  { code: 'sales', slug: 'sales', href: '/erp/modules/sales', name: 'Sales Management', description: 'Sales records and details.' },
  { code: 'reports', slug: 'reports', href: '/erp/modules/reports', name: 'Reports', description: 'Reports available to your account.' },
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

export function getVisibleErpModules(assignedModuleCodes: readonly string[]): ErpModule[] {
  const assigned = new Set(assignedModuleCodes);
  return ERP_MODULES.filter((module) => assigned.has(module.code));
}

export function getErpModuleBySlug(slug: string): ErpModule | undefined {
  return ERP_MODULES.find((module) => module.slug === slug);
}

export function canAccessErpModule(moduleCode: string, assignedModuleCodes: readonly string[]): boolean {
  return ERP_MODULES.some((module) => module.code === moduleCode) && assignedModuleCodes.includes(moduleCode);
}

export function canAccessUserManagement(role: string): role is 'admin' | 'superadmin' {
  return role === 'admin' || role === 'superadmin';
}

export function canAccessSystemSettings(role: string): boolean {
  return role === 'superadmin';
}
