// Référentiel des permissions granulaires.
// Stockées sur User.permissions (String[]) en DB.
// Les ADMIN ont tout, les STAFF se voient assigner un sous-ensemble.

export const PERMISSIONS = {
  // Produits
  PRODUCT_CREATE: "products.create",
  PRODUCT_UPDATE: "products.update",
  PRODUCT_DELETE: "products.delete",

  // Clients
  CUSTOMER_CREATE: "customers.create",
  CUSTOMER_UPDATE: "customers.update",
  CUSTOMER_DELETE: "customers.delete",

  // Locations
  RENTAL_CREATE: "rentals.create",
  RENTAL_UPDATE: "rentals.update",
  RENTAL_DELETE: "rentals.delete",

  // Ventes
  SALE_CREATE: "sales.create",
  SALE_UPDATE: "sales.update",
  SALE_DELETE: "sales.delete",

  // Caisse
  CASH_CREATE: "cash.create",
  CASH_UPDATE: "cash.update",
  CASH_DELETE: "cash.delete",

  // Inspections
  INSPECTION_CREATE: "inspections.create",
  INSPECTION_UPDATE: "inspections.update",

  // Documents
  DOCUMENT_GENERATE: "documents.generate",
  DOCUMENT_TEMPLATE_EDIT: "documentTemplates.edit",

  // Statistiques (gérant)
  STATS_VIEW: "stats.view",

  // Utilisateurs (gérant)
  USER_CREATE: "users.create",
  USER_UPDATE: "users.update",
  USER_DELETE: "users.delete",

  // Paramètres (gérant)
  SETTINGS_UPDATE: "settings.update",

  // Audit log (gérant)
  AUDIT_VIEW: "audit.view"
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// Permissions par défaut pour un nouveau staff (vendeur·se).
export const DEFAULT_STAFF_PERMISSIONS: Permission[] = [
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_UPDATE,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.CUSTOMER_UPDATE,
  PERMISSIONS.RENTAL_CREATE,
  PERMISSIONS.RENTAL_UPDATE,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.SALE_UPDATE,
  PERMISSIONS.CASH_CREATE,
  PERMISSIONS.INSPECTION_CREATE,
  PERMISSIONS.INSPECTION_UPDATE,
  PERMISSIONS.DOCUMENT_GENERATE
];

// Vérifie si un user a une permission. Les ADMIN ont tout par défaut.
export function hasPermission(
  user: { role: "ADMIN" | "STAFF"; permissions: string[] } | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.permissions.includes(permission);
}
