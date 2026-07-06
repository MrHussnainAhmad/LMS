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
export const LoginNotificationEmail = ({ ip, userAgent, time }: { ip: string, userAgent: string, time: string }) => {
  return `
    <div style="font-family: sans-serif;">
      <h1>New Login Detected</h1>
      <p>Your account was accessed from IP: ${ip}</p>
      <p>User Agent: ${userAgent}</p>
      <p>Time: ${time}</p>
    </div>
  `;
};

export const AccountCreatedEmail = ({ name, role, email, initialPassword }: any) => {
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

export const InstitutionStatusEmail = ({ name, status, reason }: any) => {
  return `
    <div style="font-family: sans-serif;">
      <h1>Institution Registration ${status}</h1>
      <p>Hello ${name}, your registration is now ${status}.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
    </div>
  `;
};
