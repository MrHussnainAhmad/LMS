import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Gmail not configured, skipping email send.', options);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"LMS" <${process.env.GMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`Email sent successfully to ${options.to}`);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

// Minimal email templates as functions returning HTML strings
export const LoginNotificationEmail = ({
  ip,
  userAgent,
  time,
  isFirstLogin,
}: {
  ip: string;
  userAgent: string;
  time: string;
  isFirstLogin: boolean;
}) => {
  const title = isFirstLogin ? "New Login Detected" : "You have logged in to the system";
  const message = isFirstLogin
    ? "Your account has been accessed for the first time."
    : "This is an alert to tell you that your account has been logged in. If this was not you, it is time to change your password.";

  return `
    <div style="font-family: sans-serif;">
      <h1>${title}</h1>
      <p>${message}</p>
      <p>Your account was accessed from IP: ${ip}</p>
      <p>User Agent: ${userAgent}</p>
      <p>Time: ${time}</p>
    </div>
  `;
};

export const AccountCreatedEmail = ({
  name,
  role,
  email,
  initialPassword,
}: {
  name: string;
  role: string;
  email: string;
  initialPassword: string;
}) => {
  return `
    <div style="font-family: sans-serif;">
      <h1>Welcome ${name}!</h1>
      <p>Your ${role} account has been created.</p>
      <p>Email/Username: ${email}</p>
      <p>Temporary Password: ${initialPassword}</p>
      <p>Please change your password upon first login.</p>
    </div>
  `;
};

export const InstitutionStatusEmail = ({
  name,
  status,
  reason,
}: {
  name: string;
  status: string;
  reason?: string | null;
}) => {
  return `
    <div style="font-family: sans-serif;">
      <h1>Institution Registration ${status}</h1>
      <p>Hello ${name}, your registration is now ${status}.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
    </div>
  `;
};
