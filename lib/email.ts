import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER ou GMAIL_APP_PASSWORD manquant — configurer dans .env (app password Gmail)"
    );
  }
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass }
  });
  return cached;
}

export async function sendEmail({
  to,
  subject,
  html,
  text
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "Maya Couture";
  const fromAddress = process.env.GMAIL_USER!;
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text: text ?? stripHtml(html),
    html
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
