import nodemailer from 'nodemailer';
import {
  BaseEmailTemplate,
  EmailHeadline,
  EmailBodyText,
  EmailCredentialStub,
  EmailSecurityNote,
  escapeEmailHtml,
} from './email-templates';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function deliverEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail is not configured');
  }

  await transporter.sendMail({
    from: `"LMS" <${process.env.GMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  console.log(`Email sent successfully to ${options.to}`);
}

/** Legacy best-effort sender. Admission delivery uses the durable outbox. */
export async function sendEmail(options: Parameters<typeof deliverEmail>[0]) {
  try {
    await deliverEmail(options);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

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
  const title = `Welcome ${name}!`;
  const preheader = `Your ${role} account has been created.`;

  const bodyContent = 
    EmailHeadline({ headline: `Welcome ${name}!` }) +
    EmailBodyText(`Your ${role} account has been created. Use the credentials below to access your account.`) +
    EmailCredentialStub({ loginId: email, temporaryPassword: initialPassword, footerNote: 'Please change your password upon first login.' }) +
    EmailSecurityNote(`If you didn't request this account, please contact support.`);

  return BaseEmailTemplate({
    title,
    preheader,
    bodyContent,
  });
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
  const title = `Institution Registration ${status}`;
  const preheader = `Your registration is now ${status}.`;

  let content = `Hello ${name}, your registration is now <strong>${escapeEmailHtml(status)}</strong>.`;
  if (reason) {
    content += `<br><br><strong>Reason:</strong> ${escapeEmailHtml(reason)}`;
  }

  const bodyContent = 
    EmailHeadline({ headline: `Registration ${status}` }) +
    EmailBodyText(content) +
    EmailSecurityNote(`If you have any questions, please reply to this email.`);

  return BaseEmailTemplate({
    title,
    preheader,
    bodyContent,
  });
};

export const AdmissionUpdateEmail = ({
  institutionName,
  studentName,
  applicationNumber,
  title,
  description,
}: {
  institutionName: string;
  studentName: string;
  applicationNumber: string;
  title: string;
  description?: string | null;
}) => {
  const emailTitle = title;
  const preheader = `Update regarding the admission application for ${studentName}.`;

  let content = `${escapeEmailHtml(institutionName)} has updated the admission application for <strong>${escapeEmailHtml(studentName)}</strong>.<br><br>`;
  content += `<strong>Application:</strong> ${escapeEmailHtml(applicationNumber)}<br><br>`;
  if (description) {
    content += `${escapeEmailHtml(description)}<br><br>`;
  }
  content += `Sign in to the applicant portal on the institution website for the latest details.`;

  const bodyContent = 
    EmailHeadline({ eyebrow: 'Application Update', headline: title }) +
    EmailBodyText(content);

  return BaseEmailTemplate({
    title: emailTitle,
    preheader,
    institutionName,
    bodyContent,
  });
};

export const AdmissionEnrollmentEmail = ({
  institutionName,
  studentName,
  loginId,
  temporaryPassword,
}: {
  institutionName: string;
  studentName: string;
  loginId: string;
  temporaryPassword: string;
}) => {
  const title = `Student account activation`;
  const preheader = `${studentName} has been enrolled at ${institutionName}.`;

  const bodyContent = 
    EmailHeadline({ eyebrow: 'Student Enrollment', headline: `Student account activation`, stamp: 'Credentials' }) +
    EmailBodyText(`<strong>${escapeEmailHtml(studentName)}</strong> has been enrolled at ${escapeEmailHtml(institutionName)}. The applicant portal remains available for seven days after enrollment so you can confirm the student login ID. After that, use the permanent student account.`) +
    EmailCredentialStub({ loginId, temporaryPassword }) +
    EmailSecurityNote(`The student must replace this password after the first login. Keep these credentials private.`);

  return BaseEmailTemplate({
    title,
    preheader,
    institutionName,
    bodyContent,
  });
};

export const AdmissionCredentialEmail = ({
  institutionName,
  accountType,
  loginId,
  temporaryPassword,
}: {
  institutionName: string;
  accountType: 'applicant' | 'student';
  loginId: string;
  temporaryPassword: string;
}) => {
  const isApplicant = accountType === 'applicant';
  const title = `${isApplicant ? 'Applicant portal' : 'Student account'} credentials`;
  const preheader = `Temporary sign-in credentials for your ${accountType} — valid for one use.`;

  const bodyContent = 
    EmailHeadline({ eyebrow: 'Account credentials', headline: `A ${accountType} account has been set up for you`, stamp: 'Temporary access' }) +
    EmailBodyText(`Sign in with the details below, then choose a permanent password. Nobody from ${escapeEmailHtml(institutionName)} will ever ask you for it.`) +
    EmailCredentialStub({ loginId, temporaryPassword }) +
    EmailSecurityNote(`If you didn't expect this email, you can ignore it — the account won't be activated until someone signs in with the password above.`);

  return BaseEmailTemplate({
    title,
    preheader,
    institutionName,
    bodyContent,
  });
};

export const ParentAccountActivationEmail = ({
  institutionName,
  institutionLogoUrl,
  studentName,
  guardianEmail,
  temporaryPassword,
  institutionUsername,
}: {
  institutionName: string;
  institutionLogoUrl?: string | null;
  studentName: string;
  guardianEmail: string;
  temporaryPassword: string;
  institutionUsername: string;
}) => {
  const title = `Parent account credentials`;
  const preheader = `You have been added as a guardian on Nisaab360.`;

  let content = `${escapeEmailHtml(institutionName)} added you as the guardian of <strong>${escapeEmailHtml(studentName)}</strong> on Nisaab360.<br><br>`;
  content += `<strong>Institution username:</strong> ${escapeEmailHtml(institutionUsername)}<br><br>`;
  content += `Sign in through the Nisaab360 parent portal and replace this temporary password immediately. The same account will show every child linked to this email within the institution.`;

  const bodyContent = 
    EmailHeadline({ eyebrow: 'Parent Account', headline: `Temporary credentials for your parent account`, stamp: 'Required Action' }) +
    EmailBodyText(content) +
    EmailCredentialStub({ loginId: guardianEmail, temporaryPassword }) +
    EmailSecurityNote(`If you do not recognize this institution or student link, contact the institution directly.`);

  return BaseEmailTemplate({
    title,
    preheader,
    institutionName,
    institutionLogoUrl: institutionLogoUrl || undefined,
    bodyContent,
  });
};

export const ParentStudentLinkedEmail = ({
  institutionName,
  institutionLogoUrl,
  studentName,
  guardianEmail,
}: {
  institutionName: string;
  institutionLogoUrl?: string | null;
  studentName: string;
  guardianEmail: string;
}) => {
  const title = `New student linked to your account`;
  const preheader = `You have been added as the guardian of ${studentName}.`;
  
  let content = `${escapeEmailHtml(institutionName)} added you as the guardian of <strong>${escapeEmailHtml(studentName)}</strong> on Nisaab360.<br><br>`;
  content += `You can now view this student's details by signing into the Nisaab360 parent portal using this email address (${escapeEmailHtml(guardianEmail)}).`;

  const bodyContent = 
    EmailHeadline({ eyebrow: 'Parent Account', headline: `New student linked`, stamp: 'Update' }) +
    EmailBodyText(content) +
    EmailSecurityNote(`If you do not recognize this institution or student link, contact the institution directly.`);

  return BaseEmailTemplate({
    title,
    preheader,
    institutionName,
    institutionLogoUrl: institutionLogoUrl || undefined,
    bodyContent,
  });
};
