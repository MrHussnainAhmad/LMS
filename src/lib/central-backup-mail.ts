import nodemailer from "nodemailer";
// Recovery secrets must bypass the ordinary plaintext email outbox and best-effort sender.
export async function sendRecoveryEmail(
  to: string,
  subject: string,
  text: string,
) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)
    throw Error("Recovery email delivery is not configured");
  const smtp = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  try {
    const result = await smtp.sendMail({
      from: `"Nisaab360 Recovery" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });
    if (
      !result.accepted?.some(
        (address: unknown) =>
          String(address).toLowerCase() === to.toLowerCase(),
      )
    )
      throw Error("Recovery recipient was not accepted");
  } finally {
    smtp.close();
  }
}
