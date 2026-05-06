import { prisma } from "@/lib/prisma";

export type RecapData = {
  dateLabel: string;
  today: {
    departures: number;
    returns: number;
    paymentsTotal: number;
    salesCount: number;
    salesTotal: number;
    expensesTotal: number;
    netCash: number;
  };
  tomorrow: {
    departures: number;
    returns: number;
  };
  alerts: {
    overdueDeposits: { reference: string; customer: string; amount: number }[];
    outOfStockProducts: { name: string; ref: string }[];
  };
};

export async function buildDailyRecap(): Promise<RecapData> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const sevenDaysAgo = addDays(today, -7);

  const dateLabel = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const [
    departuresToday,
    returnsToday,
    paymentsToday,
    salesToday,
    expensesToday,
    departuresTomorrow,
    returnsTomorrow,
    overdueDeposits,
    outOfStockVariants
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        OR: [
          { startDate1: { gte: today, lt: tomorrow } },
          { startDate2: { gte: today, lt: tomorrow } }
        ]
      }
    }),
    prisma.reservation.count({
      where: {
        status: { in: ["IN_PROGRESS", "RETURNED", "CONFIRMED"] },
        OR: [
          { endDate1: { gte: today, lt: tomorrow } },
          { endDate2: { gte: today, lt: tomorrow } }
        ]
      }
    }),
    prisma.cashTransaction.aggregate({
      where: {
        kind: "CLIENT_PAYMENT",
        occurredAt: { gte: today, lt: tomorrow }
      },
      _sum: { amount: true }
    }),
    prisma.sale.findMany({
      where: { status: "COMPLETED", saleDate: { gte: today, lt: tomorrow } },
      select: { totalAmount: true }
    }),
    prisma.cashTransaction.aggregate({
      where: { kind: "EXPENSE", occurredAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true }
    }),
    prisma.reservation.count({
      where: {
        status: { in: ["CONFIRMED", "DRAFT"] },
        OR: [
          { startDate1: { gte: tomorrow, lt: dayAfter } },
          { startDate2: { gte: tomorrow, lt: dayAfter } }
        ]
      }
    }),
    prisma.reservation.count({
      where: {
        status: { in: ["IN_PROGRESS", "CONFIRMED"] },
        OR: [
          { endDate1: { gte: tomorrow, lt: dayAfter } },
          { endDate2: { gte: tomorrow, lt: dayAfter } }
        ]
      }
    }),
    findOverdueDeposits(sevenDaysAgo),
    prisma.productVariant.findMany({
      where: { quantityCurrent: 0 },
      include: { product: { select: { name: true, reference: true } } },
      take: 10
    })
  ]);

  const paymentsTotal = Number(paymentsToday._sum.amount ?? 0);
  const salesTotal = salesToday.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const expensesTotal = Number(expensesToday._sum.amount ?? 0);

  return {
    dateLabel,
    today: {
      departures: departuresToday,
      returns: returnsToday,
      paymentsTotal,
      salesCount: salesToday.length,
      salesTotal,
      expensesTotal,
      netCash: paymentsTotal + salesTotal - expensesTotal
    },
    tomorrow: {
      departures: departuresTomorrow,
      returns: returnsTomorrow
    },
    alerts: {
      overdueDeposits,
      outOfStockProducts: outOfStockVariants.map((v) => ({
        name: v.product.name,
        ref: v.product.reference
      }))
    }
  };
}

async function findOverdueDeposits(threshold: Date) {
  const candidates = await prisma.reservation.findMany({
    where: {
      status: "RETURNED",
      updatedAt: { lt: threshold }
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      cashTx: { select: { kind: true, amount: true } }
    },
    take: 50
  });

  const out: { reference: string; customer: string; amount: number }[] = [];
  for (const r of candidates) {
    const held = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_HELD")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const back = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_BACK")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const remaining = held - back;
    if (held > 0 && remaining > 0.01) {
      out.push({
        reference: r.reference,
        customer: `${r.customer.firstName} ${r.customer.lastName}`,
        amount: remaining
      });
    }
  }
  return out;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ─── Template HTML ──────────────────────────────────────────────────────────

const BORDEAUX = "#691524";
const BEIGE = "#e4e0dd";
const TEXT = "#201216";
const MUTED = "#71607a";
const PUBLIC_URL = process.env.NEXTAUTH_URL ?? "";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2
  }).format(n);
}

export function renderRecapEmail(data: RecapData, recipientName: string): string {
  const todayBlocks = [
    block("Sorties", String(data.today.departures), "robes parties"),
    block("Retours", String(data.today.returns), "robes revenues"),
    block("Encaissé", fmtCurrency(data.today.paymentsTotal), "paiements clientes"),
    block(
      "Ventes",
      data.today.salesCount > 0 ? fmtCurrency(data.today.salesTotal) : "—",
      `${data.today.salesCount} vente${data.today.salesCount > 1 ? "s" : ""}`
    ),
    block("Dépenses", fmtCurrency(data.today.expensesTotal), "sorties caisse"),
    block(
      "Solde net",
      fmtCurrency(data.today.netCash),
      data.today.netCash >= 0 ? "positif" : "négatif",
      data.today.netCash >= 0 ? "#16a34a" : "#dc2626"
    )
  ].join("");

  const tomorrowBlock =
    data.tomorrow.departures + data.tomorrow.returns > 0
      ? `
        <p style="margin:0 0 12px;font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;font-weight:600;">Demain</p>
        <p style="margin:0;font-size:15px;color:${TEXT};line-height:1.6;">
          <strong>${data.tomorrow.departures}</strong> départ${data.tomorrow.departures > 1 ? "s" : ""} prévu${data.tomorrow.departures > 1 ? "s" : ""}
          · <strong>${data.tomorrow.returns}</strong> retour${data.tomorrow.returns > 1 ? "s" : ""} prévu${data.tomorrow.returns > 1 ? "s" : ""}
        </p>
      `
      : `
        <p style="margin:0 0 12px;font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;font-weight:600;">Demain</p>
        <p style="margin:0;font-size:15px;color:${MUTED};">Aucun mouvement prévu.</p>
      `;

  const alerts = renderAlerts(data.alerts);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Récap du ${data.dateLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f1ece6;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1ece6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(35,12,18,0.05),0 4px 16px rgba(35,12,18,0.07);">
          <!-- Header -->
          <tr>
            <td style="background:${BEIGE};padding:24px 28px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${BORDEAUX};font-weight:600;">Récap quotidien</p>
              <h1 style="margin:6px 0 0;font-size:24px;color:${TEXT};font-weight:600;text-transform:capitalize;">${data.dateLabel}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">Bonjour ${escapeHtml(recipientName.split(" ")[0] || recipientName)},</p>
            </td>
          </tr>

          <!-- Aujourd'hui -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;font-weight:600;">Aujourd'hui</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${todayBlocks}
              </table>
            </td>
          </tr>

          <!-- Demain -->
          <tr>
            <td style="padding:0 28px 28px;">
              <div style="border-top:1px solid #e4e4e7;padding-top:24px;">
                ${tomorrowBlock}
              </div>
            </td>
          </tr>

          ${alerts}

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 28px 28px;">
              <a href="${PUBLIC_URL}/dashboard" style="display:inline-block;background:${BORDEAUX};color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:600;">
                Voir le tableau de bord
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${BEIGE};padding:18px 28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:${MUTED};letter-spacing:0.06em;">
                Maya Couture · Récap envoyé automatiquement chaque soir
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function block(label: string, value: string, hint: string, color = BORDEAUX): string {
  return `
    <tr>
      <td style="padding:8px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf7f3;border-radius:12px;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0;font-size:12px;color:${MUTED};font-weight:500;">${label}</p>
              <p style="margin:4px 0 0;font-size:22px;color:${color};font-weight:700;">${value}</p>
              <p style="margin:2px 0 0;font-size:11px;color:${MUTED};">${hint}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderAlerts(alerts: RecapData["alerts"]): string {
  const hasAlerts =
    alerts.overdueDeposits.length > 0 || alerts.outOfStockProducts.length > 0;
  if (!hasAlerts) return "";

  const deposits = alerts.overdueDeposits.length > 0
    ? `
      <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 16px;border-radius:8px;margin-bottom:12px;">
        <p style="margin:0;font-size:13px;color:#78350f;font-weight:600;">⚠ ${alerts.overdueDeposits.length} caution${alerts.overdueDeposits.length > 1 ? "s" : ""} non rendue${alerts.overdueDeposits.length > 1 ? "s" : ""} (≥ 7 jours)</p>
        <ul style="margin:8px 0 0;padding:0 0 0 18px;font-size:13px;color:#78350f;">
          ${alerts.overdueDeposits
            .slice(0, 5)
            .map(
              (d) =>
                `<li>${escapeHtml(d.reference)} · ${escapeHtml(d.customer)} · <strong>${fmtCurrency(d.amount)}</strong></li>`
            )
            .join("")}
        </ul>
      </div>`
    : "";

  const stock = alerts.outOfStockProducts.length > 0
    ? `
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;font-weight:600;">📦 ${alerts.outOfStockProducts.length} variante${alerts.outOfStockProducts.length > 1 ? "s" : ""} en rupture</p>
        <p style="margin:6px 0 0;font-size:13px;color:#7f1d1d;">${alerts.outOfStockProducts.slice(0, 5).map((p) => `${escapeHtml(p.name)}`).join(" · ")}${alerts.outOfStockProducts.length > 5 ? "…" : ""}</p>
      </div>`
    : "";

  return `
    <tr>
      <td style="padding:0 28px 28px;">
        <div style="border-top:1px solid #e4e4e7;padding-top:24px;">
          <p style="margin:0 0 12px;font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;font-weight:600;">Alertes</p>
          ${deposits}
          ${stock}
        </div>
      </td>
    </tr>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
