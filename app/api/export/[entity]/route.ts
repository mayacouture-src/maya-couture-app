// Export CSV / Excel des listes du back-office.
// URL : /api/export/<entity>?format=csv|xlsx&<filtres comme la page>
// Entités supportées : products | rentals | customers | sales | cash | operations | users
//
// Les filtres sont les mêmes search params que la page liste correspondante,
// pour que "Exporter" reflète exactement ce que l'utilisateur voit.

import {
  AuditOperation,
  CashKind,
  ReservationStatus,
  Role,
  SaleStatus,
  UserStatus
} from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  exportFilename,
  toCsv,
  toXlsx,
  type Column
} from "@/lib/export";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Format = "csv" | "xlsx";

const ENTITIES = [
  "products",
  "rentals",
  "customers",
  "sales",
  "cash",
  "operations",
  "users"
] as const;
type Entity = (typeof ENTITIES)[number];

function isEntity(s: string): s is Entity {
  return (ENTITIES as readonly string[]).includes(s);
}

function safeDate(s: string | null, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { entity } = await params;
  if (!isEntity(entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 400 });
  }

  // Modules admin-only : audit, équipe, caisse — la même règle s'applique
  // à l'export pour qu'une vendeuse ne puisse pas extraire ces données.
  const ADMIN_ONLY_ENTITIES: Entity[] = ["operations", "users", "cash"];
  if (
    ADMIN_ONLY_ENTITIES.includes(entity) &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format: Format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const isAdmin = session.user.role === "ADMIN";
  const built = await buildExport(entity, url.searchParams, { isAdmin });

  if (format === "csv") {
    const csv = toCsv(built.rows, built.cols);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(entity, "csv")}"`
      }
    });
  }

  const buf = await toXlsx(built.rows, built.cols, built.sheet);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFilename(entity, "xlsx")}"`
    }
  });
}

// ─── Builders par entité ──────────────────────────────────────────────────

type Built<T> = { rows: T[]; cols: Column<T>[]; sheet: string };
type BuildOpts = { isAdmin: boolean };

async function buildExport(
  entity: Entity,
  params: URLSearchParams,
  opts: BuildOpts
): Promise<Built<unknown>> {
  switch (entity) {
    case "products":
      return (await buildProducts(params, opts)) as Built<unknown>;
    case "rentals":
      return (await buildRentals(params)) as Built<unknown>;
    case "customers":
      return (await buildCustomers(params)) as Built<unknown>;
    case "sales":
      return (await buildSales(params)) as Built<unknown>;
    case "cash":
      return (await buildCash(params)) as Built<unknown>;
    case "operations":
      return (await buildOperations(params)) as Built<unknown>;
    case "users":
      return (await buildUsers(params)) as Built<unknown>;
  }
}

// --- products ---
async function buildProducts(params: URLSearchParams, opts: BuildOpts) {
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "";
  const stock = params.get("stock") ?? "";

  const products = await prisma.product.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { reference: { contains: q, mode: "insensitive" } },
                { designer: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        category ? { category } : {},
        type === "rentable" ? { isRentable: true } : {},
        type === "sellable" ? { isSellable: true } : {}
      ]
    },
    include: { variants: { orderBy: [{ size: "asc" }, { color: "asc" }] } },
    orderBy: { createdAt: "desc" }
  });

  const filtered = products.filter((p) => {
    if (stock === "in") return p.variants.some((v) => v.quantityCurrent > 0);
    if (stock === "out") return p.variants.every((v) => v.quantityCurrent === 0);
    return true;
  });

  // Une ligne par variante (stock granulaire). Les colonnes "produit" sont
  // répétées, ce qui est ce que les utilisateurs attendent dans Excel.
  type Row = {
    productRef: string;
    productName: string;
    designer: string;
    category: string;
    size: string;
    color: string;
    quantityCurrent: number;
    quantityInitial: number;
    rentable: string;
    sellable: string;
    rentalPrice: number;
    salePrice: number;
    deposit: number;
    purchasePrice: number;
    createdAt: Date;
  };
  const rows: Row[] = filtered.flatMap((p) =>
    p.variants.length === 0
      ? [
          {
            productRef: p.reference,
            productName: p.name,
            designer: p.designer ?? "",
            category: p.category ?? "",
            size: "",
            color: "",
            quantityCurrent: 0,
            quantityInitial: 0,
            rentable: p.isRentable ? "Oui" : "Non",
            sellable: p.isSellable ? "Oui" : "Non",
            rentalPrice: Number(p.rentalPrice),
            salePrice: Number(p.salePrice),
            deposit: Number(p.deposit),
            purchasePrice: Number(p.purchasePrice),
            createdAt: p.createdAt
          }
        ]
      : p.variants.map((v) => ({
          productRef: p.reference,
          productName: p.name,
          designer: p.designer ?? "",
          category: p.category ?? "",
          size: v.size,
          color: v.color,
          quantityCurrent: v.quantityCurrent,
          quantityInitial: v.quantityInitial,
          rentable: p.isRentable ? "Oui" : "Non",
          sellable: p.isSellable ? "Oui" : "Non",
          rentalPrice: Number(p.rentalPrice),
          salePrice: Number(p.salePrice),
          deposit: Number(p.deposit),
          purchasePrice: Number(p.purchasePrice),
          createdAt: p.createdAt
        }))
  );

  const cols: Column<Row>[] = [
    { header: "Référence", width: 14, value: (r) => r.productRef },
    { header: "Nom", width: 28, value: (r) => r.productName },
    { header: "Créateur", width: 18, value: (r) => r.designer },
    { header: "Catégorie", width: 14, value: (r) => r.category },
    { header: "Taille", width: 8, value: (r) => r.size },
    { header: "Couleur", width: 14, value: (r) => r.color },
    { header: "Stock actuel", width: 12, value: (r) => r.quantityCurrent },
    { header: "Stock initial", width: 12, value: (r) => r.quantityInitial },
    { header: "Louable", width: 10, value: (r) => r.rentable },
    { header: "Vendable", width: 10, value: (r) => r.sellable },
    { header: "Prix location", width: 14, value: (r) => r.rentalPrice },
    { header: "Prix vente", width: 12, value: (r) => r.salePrice },
    { header: "Caution", width: 12, value: (r) => r.deposit },
    // Prix d'achat : admin-only — c'est une donnée interne (marge,
    // négociation fournisseur). Une vendeuse ne devrait pas l'avoir dans
    // un export.
    ...(opts.isAdmin
      ? [
          {
            header: "Prix achat",
            width: 12,
            value: (r: Row) => r.purchasePrice
          } as Column<Row>
        ]
      : []),
    { header: "Créé le", width: 12, value: (r) => r.createdAt }
  ];
  return { rows, cols, sheet: "Catalogue" };
}

// --- rentals ---
async function buildRentals(params: URLSearchParams) {
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const from = safeDate(params.get("from"));
  const to = safeDate(params.get("to"), true);

  const RESERVATION_STATUSES = [
    "DRAFT",
    "CONFIRMED",
    "IN_PROGRESS",
    "RETURNED",
    "COMPLETED",
    "CANCELLED"
  ] as const;
  const statusFilter: { status?: ReservationStatus } = (
    RESERVATION_STATUSES as readonly string[]
  ).includes(status)
    ? { status: status as ReservationStatus }
    : {};

  const reservations = await prisma.reservation.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" } },
                { customer: { firstName: { contains: q, mode: "insensitive" } } },
                { customer: { lastName: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {},
        statusFilter,
        from || to
          ? {
              OR: [
                from && to
                  ? { startDate1: { gte: from, lte: to } }
                  : from
                    ? { startDate1: { gte: from } }
                    : { startDate1: { lte: to as Date } }
              ]
            }
          : {}
      ]
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          city: true
        }
      },
      _count: { select: { items: true } }
    },
    orderBy: [{ status: "asc" }, { startDate1: "desc" }]
  });

  type Row = (typeof reservations)[number];
  const cols: Column<Row>[] = [
    { header: "Référence", width: 14, value: (r) => r.reference },
    { header: "Statut", width: 12, value: (r) => r.status },
    {
      header: "Cliente",
      width: 24,
      value: (r) => `${r.customer.firstName} ${r.customer.lastName}`
    },
    { header: "Téléphone", width: 14, value: (r) => r.customer.phone },
    { header: "Email", width: 22, value: (r) => r.customer.email ?? "" },
    { header: "Ville", width: 14, value: (r) => r.customer.city ?? "" },
    { header: "Départ 1", width: 12, value: (r) => r.startDate1 },
    { header: "Retour 1", width: 12, value: (r) => r.endDate1 },
    { header: "Départ 2", width: 12, value: (r) => r.startDate2 ?? "" },
    { header: "Retour 2", width: 12, value: (r) => r.endDate2 ?? "" },
    { header: "Articles", width: 10, value: (r) => r._count.items },
    { header: "Total", width: 12, value: (r) => Number(r.totalPrice) },
    { header: "Caution totale", width: 14, value: (r) => Number(r.totalDeposit) },
    { header: "Créé le", width: 14, value: (r) => r.createdAt }
  ];
  return { rows: reservations, cols, sheet: "Locations" };
}

// --- customers ---
async function buildCustomers(params: URLSearchParams) {
  const q = params.get("q") ?? "";
  const city = params.get("city") ?? "";
  const activity = params.get("activity") ?? "";

  const customers = await prisma.customer.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        city ? { city } : {}
      ]
    },
    include: { _count: { select: { reservations: true, sales: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });

  const filtered = customers.filter((c) => {
    const total = c._count.reservations + c._count.sales;
    if (activity === "with") return total > 0;
    if (activity === "without") return total === 0;
    return true;
  });

  type Row = (typeof filtered)[number];
  const cols: Column<Row>[] = [
    { header: "Prénom", width: 16, value: (r) => r.firstName },
    { header: "Nom", width: 18, value: (r) => r.lastName },
    { header: "Téléphone", width: 14, value: (r) => r.phone },
    { header: "Email", width: 24, value: (r) => r.email ?? "" },
    { header: "Adresse", width: 28, value: (r) => r.address ?? "" },
    { header: "CP", width: 8, value: (r) => r.postalCode ?? "" },
    { header: "Ville", width: 14, value: (r) => r.city ?? "" },
    { header: "Pièce d'identité", width: 18, value: (r) => r.idDocumentRef ?? "" },
    { header: "Locations", width: 10, value: (r) => r._count.reservations },
    { header: "Ventes", width: 10, value: (r) => r._count.sales },
    { header: "Notes", width: 30, value: (r) => r.notes ?? "" },
    { header: "Ajoutée le", width: 14, value: (r) => r.createdAt }
  ];
  return { rows: filtered, cols, sheet: "Clientes" };
}

// --- sales ---
async function buildSales(params: URLSearchParams) {
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const from = safeDate(params.get("from"));
  const to = safeDate(params.get("to"), true);
  const customer = params.get("customer") ?? "";

  const statusOk = (["DRAFT", "COMPLETED", "CANCELLED"] as string[]).includes(status);

  const sales = await prisma.sale.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" } },
                { customer: { firstName: { contains: q, mode: "insensitive" } } },
                { customer: { lastName: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {},
        statusOk ? { status: status as SaleStatus } : {},
        from ? { saleDate: { gte: from } } : {},
        to ? { saleDate: { lte: to } } : {},
        customer === "with" ? { customerId: { not: null } } : {},
        customer === "anon" ? { customerId: null } : {}
      ]
    },
    include: {
      customer: {
        select: { firstName: true, lastName: true, phone: true, email: true }
      },
      _count: { select: { items: true } }
    },
    orderBy: { saleDate: "desc" }
  });

  type Row = (typeof sales)[number];
  const cols: Column<Row>[] = [
    { header: "Référence", width: 14, value: (r) => r.reference },
    { header: "Statut", width: 12, value: (r) => r.status },
    { header: "Date", width: 12, value: (r) => r.saleDate },
    {
      header: "Cliente",
      width: 24,
      value: (r) =>
        r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : "(Anonyme)"
    },
    { header: "Téléphone", width: 14, value: (r) => r.customer?.phone ?? "" },
    { header: "Email", width: 22, value: (r) => r.customer?.email ?? "" },
    { header: "Articles", width: 10, value: (r) => r._count.items },
    { header: "Total", width: 12, value: (r) => Number(r.totalAmount) }
  ];
  return { rows: sales, cols, sheet: "Ventes" };
}

// --- cash ---
async function buildCash(params: URLSearchParams) {
  const range = params.get("range") ?? "today";
  const kind = params.get("kind") ?? "";
  const from = params.get("from");
  const to = params.get("to");
  const min = params.get("min");
  const max = params.get("max");

  const bounds: { from?: Date; to?: Date } = (() => {
    if (range === "all") return {};
    if (range === "custom") {
      return {
        from: safeDate(from),
        to: safeDate(to, true)
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (range === "today") return { from: today, to: tomorrow };
    if (range === "week") {
      const f = new Date(today);
      f.setDate(today.getDate() - 6);
      return { from: f, to: tomorrow };
    }
    const f = new Date(today);
    f.setDate(today.getDate() - 29);
    return { from: f, to: tomorrow };
  })();

  const KINDS = [
    "CLIENT_PAYMENT",
    "DEPOSIT_HELD",
    "DEPOSIT_BACK",
    "EXPENSE",
    "CASH_REFILL",
    "WITHDRAWAL",
    "REFUND",
    "FEE"
  ];
  const kindOk = KINDS.includes(kind);
  const minN = min ? Number(min) : undefined;
  const maxN = max ? Number(max) : undefined;

  const movements = await prisma.cashTransaction.findMany({
    where: {
      AND: [
        bounds.from ? { occurredAt: { gte: bounds.from } } : {},
        bounds.to ? { occurredAt: { lt: bounds.to } } : {},
        kindOk ? { kind: kind as CashKind } : {},
        minN !== undefined && !Number.isNaN(minN) ? { amount: { gte: minN } } : {},
        maxN !== undefined && !Number.isNaN(maxN) ? { amount: { lte: maxN } } : {}
      ]
    },
    include: {
      reservation: {
        select: {
          reference: true,
          customer: { select: { firstName: true, lastName: true } }
        }
      },
      sale: { select: { reference: true } },
      recordedBy: { select: { name: true } }
    },
    orderBy: { occurredAt: "desc" }
  });

  type Row = (typeof movements)[number];
  const cols: Column<Row>[] = [
    { header: "Date", width: 18, value: (r) => r.occurredAt },
    { header: "Type", width: 16, value: (r) => r.kind },
    { header: "Méthode", width: 12, value: (r) => r.method },
    { header: "Montant", width: 12, value: (r) => Number(r.amount) },
    { header: "Catégorie", width: 14, value: (r) => r.category ?? "" },
    { header: "Description", width: 30, value: (r) => r.description ?? "" },
    {
      header: "Location liée",
      width: 14,
      value: (r) => r.reservation?.reference ?? ""
    },
    {
      header: "Cliente",
      width: 22,
      value: (r) =>
        r.reservation?.customer
          ? `${r.reservation.customer.firstName} ${r.reservation.customer.lastName}`
          : ""
    },
    { header: "Vente liée", width: 14, value: (r) => r.sale?.reference ?? "" },
    { header: "Saisi par", width: 16, value: (r) => r.recordedBy.name },
    { header: "Notes", width: 28, value: (r) => r.notes ?? "" }
  ];
  return { rows: movements, cols, sheet: "Caisse" };
}

// --- operations ---
async function buildOperations(params: URLSearchParams) {
  const entityFilter = params.get("entity") ?? "";
  const operation = params.get("operation") ?? "";
  const userId = params.get("user") ?? "";
  const from = safeDate(params.get("from"));
  const to = safeDate(params.get("to"), true);

  const opOk = (["CREATE", "UPDATE", "DELETE"] as string[]).includes(operation);

  const logs = await prisma.auditLog.findMany({
    where: {
      AND: [
        entityFilter ? { entityType: entityFilter } : {},
        opOk ? { operation: operation as AuditOperation } : {},
        userId ? { userId } : {},
        from ? { occurredAt: { gte: from } } : {},
        to ? { occurredAt: { lte: to } } : {}
      ]
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { occurredAt: "desc" }
  });

  type Row = (typeof logs)[number];
  const cols: Column<Row>[] = [
    { header: "Date", width: 20, value: (r) => r.occurredAt },
    { header: "Opération", width: 12, value: (r) => r.operation },
    { header: "Entité", width: 16, value: (r) => r.entityType },
    { header: "ID entité", width: 26, value: (r) => r.entityId },
    { header: "Utilisateur", width: 18, value: (r) => r.user.name },
    { header: "Email", width: 24, value: (r) => r.user.email },
    {
      header: "Diff (résumé)",
      width: 40,
      value: (r) => (r.diff ? JSON.stringify(r.diff).slice(0, 500) : "")
    }
  ];
  return { rows: logs, cols, sheet: "Audit" };
}

// --- users ---
async function buildUsers(params: URLSearchParams) {
  const q = params.get("q") ?? "";
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";

  const roleOk = (["ADMIN", "STAFF"] as string[]).includes(role);
  const statusOk = (["ACTIVE", "DISABLED"] as string[]).includes(status);

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        roleOk ? { role: role as Role } : {},
        statusOk ? { status: status as UserStatus } : {}
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true
    },
    orderBy: { name: "asc" }
  });

  type Row = (typeof users)[number];
  const cols: Column<Row>[] = [
    { header: "Nom", width: 20, value: (r) => r.name },
    { header: "Email", width: 28, value: (r) => r.email },
    { header: "Rôle", width: 10, value: (r) => r.role },
    { header: "Statut", width: 12, value: (r) => r.status },
    {
      header: "Dernière connexion",
      width: 20,
      value: (r) => r.lastLoginAt ?? ""
    },
    { header: "Créé le", width: 14, value: (r) => r.createdAt }
  ];
  return { rows: users, cols, sheet: "Équipe" };
}
