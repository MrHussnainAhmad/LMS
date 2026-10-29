import type { PricingPlan, PlanDefinition } from './plan-types';

// Publish a new version whenever the registration agreement changes. Accepted
// documents are stored separately, so later edits cannot rewrite past consent.
export const SERVICE_AGREEMENT_VERSION = '2026-10-29.1';
export const SERVICE_AGREEMENT_INTRODUCTION = 'This Service Agreement is between Nisaab360 (the Provider) and the Institution identified above. The individual accepting it acts on behalf of the Institution as its authorised representative.';

export const SERVICE_AGREEMENT_SECTIONS = [
  {
    title: 'Scope of Services and Activation',
    content: 'Nisaab360 provides online access to its learning management platform under the selected subscription plan. Registration is an application for service and does not guarantee approval or immediate activation. Activation is subject to approval, receipt of required information, and payment of applicable setup and subscription fees. Custom development, hardware, on-site visits, extensive data cleanup, and services outside the selected plan require a separate written quotation.',
  },
  {
    title: 'Fees, Billing and Student Counts',
    content: 'Setup fees and subscription fees are payable in advance in Pakistani rupees, by the due date stated on the invoice. Monthly subscriptions cover consecutive monthly billing periods from activation unless a written quotation specifies otherwise. Applicable taxes and third-party charges are payable as stated on the quotation or invoice. The Institution must select a plan appropriate to its student and campus counts. Public plan fees and allowances are those selected and recorded at registration. A Dealed offer is private to the registering institution: its monthly fee is the recorded per-student price multiplied by the recorded billed student count, with the student, campus, platform and device allowances shown in this Agreement. A starting per-student public rate is not a fixed-price quotation; individually negotiated terms must be confirmed in writing before activation. Additional capacity or services may require an upgrade or additional charges agreed before supply.',
  },
  {
    title: 'Overdue Payments and Suspension',
    content: 'If an invoice remains unpaid seven calendar days after its due date, Nisaab360 may suspend access after notifying the registered contact. Access may remain suspended until overdue charges are settled. Suspension does not cancel charges already due or extend the paid subscription period. No additional renewal period will be charged solely because an account remains suspended, unless the Institution has separately agreed to a minimum subscription commitment. Security threats, fraud, unlawful activity, or serious misuse may result in immediate restriction or suspension without the payment grace period.',
  },
  {
    title: 'Refunds',
    content: 'Setup fees become non-refundable once onboarding, configuration, or data setup work begins. Fees for a subscription period that has already started are generally non-refundable, including where the Institution uses only part of the period or cancels for convenience. This does not exclude refunds required by applicable law or an express written commitment. If Nisaab360 permanently discontinues the paid Service for convenience before the end of a prepaid period, it will refund the unused subscription portion on a proportionate basis, after deducting any lawfully due amounts.',
  },
  {
    title: 'Onboarding and Support',
    content: 'The target for standard online onboarding is seven calendar days after payment, account approval, and receipt of complete, accurate information in the requested format. Institution delays, corrections, unsupported formats, or additional requirements may extend this target. Support is provided remotely through the channels and working hours communicated at activation or in the applicable support policy. Response targets are not guaranteed resolution times. On-site assistance, custom integrations, and additional training are excluded unless agreed in writing.',
  },
  {
    title: 'Subscription, Renewal and Cancellation',
    content: 'Subscriptions renew monthly unless a written quotation specifies another term. The Institution must give at least 30 calendar days of cancellation or non-renewal notice through the support channel or registered email. Cancellation takes effect at the end of the applicable billing period after the notice period, subject to any separately agreed minimum term. Charges due up to the effective cancellation date remain payable. Nisaab360 may discontinue the Service for convenience with at least 30 calendar days of notice, subject to the refund and export provisions of this Agreement.',
  },
  {
    title: 'Institution Responsibilities and Authorised Use',
    content: 'The Institution is responsible for the accuracy, legality, and completeness of uploaded records; obtaining required permissions and notices for student, parent, and staff information, including information about minors; and ensuring that its users are authorised. The Institution must protect credentials, promptly report suspected compromise, remove access for departing users, and supervise activity through its accounts. Shared credentials, resale, unlawful content, unauthorised access, malicious uploads, and attempts to disrupt the platform are prohibited. Academic, disciplinary, payroll, admissions, and fee decisions remain the Institution\'s responsibility; it must review outputs before relying on them.',
  },
  {
    title: 'Data Ownership, Privacy and Security',
    content: 'The Institution retains ownership of the data it supplies and authorises Nisaab360 and its necessary service providers to process that data to deliver, secure, support, and administer the Service. Both parties must protect confidential information and limit access to authorised persons, except for lawful disclosures. Nisaab360 will use reasonable technical and organisational safeguards and handle personal information in accordance with its applicable privacy policy and law. No internet service can guarantee absolute security or freedom from unauthorised access. This does not remove either party\'s legal duties or responsibility for its own breach.',
  },
  {
    title: 'Backups, Export and Post-Termination Data',
    content: 'Backup and restoration services are limited to the facilities and retention schedules included in the selected plan or separately agreed in writing. Backups do not guarantee zero data loss or recovery of every record, file, or external asset. The Institution should keep suitable independent copies and regularly export critical records. It may request export of its available data in a supported format within 30 calendar days after termination; supervised export assistance may be arranged if normal access is suspended. Custom conversion, historical reconstruction, and migration work may be separately chargeable. After that window, Nisaab360 may delete active data unless retention is legally required. Residual backups expire under their rotation schedules and are not a continuing hosted service.',
  },
  {
    title: 'Availability, Maintenance and External Services',
    content: 'The Service is supplied on an as-available basis. Planned maintenance will be notified where reasonably practicable; urgent maintenance may occur without advance notice. Internet connectivity, devices, hosting, storage, email, payment gateways, and other external services may affect availability. Nisaab360 does not guarantee their uninterrupted operation and is not responsible for failures outside its reasonable control, while remaining responsible for its own contractual duties. Payment gateways process transactions under their own terms; the Institution remains responsible for its merchant account, school fee disputes, refunds, and reconciliations. No uptime guarantee, service credit, or disaster-recovery deadline applies unless expressly agreed in writing.',
  },
  {
    title: 'Intellectual Property',
    content: 'Nisaab360 retains ownership of its software, designs, documentation, branding, and platform materials. The Institution receives a limited, non-exclusive, non-transferable right to use the Service for its own educational administration during its authorised subscription. No source code or ownership rights are transferred. Copying, resale, sublicensing, or reverse engineering is prohibited except where applicable law expressly permits it. The Institution retains its own branding, content, and records.',
  },
  {
    title: 'Warranties and Limitation of Liability',
    content: 'Except for express commitments in this Agreement and rights that cannot lawfully be excluded, the Service is provided as is and as available, without a guarantee of error-free operation or a particular academic or commercial outcome. To the extent permitted by applicable law, neither party is liable to the other for indirect or consequential loss or lost profits arising from the Service. Nisaab360\'s total aggregate liability arising from the Agreement is limited to subscription fees actually paid by the Institution for the affected Service during the three months immediately preceding the event giving rise to the claim. These exclusions and the cap do not apply to fraud, wilful misconduct, or any liability that applicable law does not allow to be excluded or limited.',
  },
  {
    title: 'Breach, Termination and Force Majeure',
    content: 'Either party may terminate for a material breach that remains uncorrected 15 calendar days after written notice describing the breach. This cure period does not prevent immediate suspension for serious misuse, unlawful activity, or a security threat. Nisaab360 may terminate for a breach that cannot reasonably be remedied or for repeated serious violations. Neither party is responsible for delay caused by events beyond its reasonable control, provided it takes reasonable steps to reduce the impact. Accrued payment obligations, confidentiality, intellectual property protections, and liability provisions survive termination where applicable.',
  },
  {
    title: 'Price Changes, Agreement Changes and Notices',
    content: 'Changes to subscription prices require at least 30 calendar days of notice and take effect at the next renewal after that notice period, subject to any expressly agreed fixed-price term. Material changes to this Agreement will be communicated with their proposed effective date. A Read or Ignore notification is informational and does not by itself record acceptance of changed contractual obligations. Changes requiring consent must be expressly agreed by an authorised representative. Notices may be sent through the platform and to the Institution\'s registered email; the Institution must keep its contact details current. An individually agreed written quotation controls its specific commercial terms; this Agreement controls other matters.',
  },
  {
    title: 'Authority, Electronic Acceptance and Governing Law',
    content: 'The person submitting registration confirms that they are authorised to act for and bind the Institution, have read this Agreement and its selected pricing, and expressly accept them on the Institution\'s behalf. Nisaab360 records the representative\'s name, registered contact email, agreement version, server acceptance time, and a copy of the accepted document. The Agreement is governed by the laws of Pakistan. The parties will first attempt to resolve disputes through written discussion for 30 calendar days after notice. Any unresolved dispute is subject to the competent courts at Lodhran, Pakistan, to the extent those courts have jurisdiction and applicable law permits the choice. If a provision is unenforceable, the remaining provisions continue to apply.',
  },
] as const;

export type ServiceAgreementSnapshot = {
  version: string;
  introduction: string;
  institution: { name: string; address: string; city: string; country: string; contactEmail: string };
  representativeName: string;
  plan: { id: string; name: string; audience: string; setup: string; monthly: string; monthlyDetail: string; scale: string; campusDetail: string; definition?: PlanDefinition };
  sections: Array<{ title: string; content: string }>;
};

export function createServiceAgreementSnapshot(
  institution: ServiceAgreementSnapshot['institution'] & { pricingPlan: string },
  representativeName: string,
  plan: PricingPlan,
): ServiceAgreementSnapshot {
  const { name, address, city, country, contactEmail } = institution;
  return {
    version: SERVICE_AGREEMENT_VERSION,
    introduction: SERVICE_AGREEMENT_INTRODUCTION,
    institution: { name, address, city, country, contactEmail },
    representativeName,
    plan: { id: plan.id, name: plan.name, audience: plan.audience, setup: plan.setup, monthly: plan.monthly, monthlyDetail: plan.monthlyDetail, scale: plan.scale, campusDetail: plan.campusDetail, definition: { ...plan } },
    sections: SERVICE_AGREEMENT_SECTIONS.map(section => ({ ...section })),
  };
}
