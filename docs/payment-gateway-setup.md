# JazzCash and Easypaisa: sandbox preparation

Updated 30 October 2026. JazzCash checkout is disabled by security containment; see [security rollout](security-remediation-rollout.md). Easypaisa remains prepared for sandbox onboarding. No real merchant credentials, bank certification, live transactions, production migrations, builds or deployments were used. Mocked tests establish application behavior, not provider interoperability.

## Institution and payer flow

Institutions select exactly one payment mode: **Manual** or **Online**. Existing institutions default to Manual. Manual accounts and proof review remain available in Manual mode. Online mode currently offers usable Easypaisa checkout. JazzCash configuration/history is retained, but new JazzCash attempts and handoffs are unavailable until a supported replacement keeps reusable merchant credentials server-side; credentials are encrypted separately for each institution. Saving an enabled gateway in the portal also switches the institution to Online in the same transaction. No separate activation click, platform-admin activation or server approval flag is required. HBL is not offered. Historical gateway records remain readable.

In Online mode, students, linked parents and admission applicants select an enabled gateway. The server creates a unique attempt using the institution and outstanding fee amount from the database, rather than trusting client amounts or institution IDs. The attempt retains its merchant credential snapshot so later configuration changes cannot redirect verification to another account.

Only a valid JazzCash signed response or authenticated Easypaisa server inquiry can settle an attempt. Settlement locks the attempt and fee rows, updates the ledger/admission fee, and saves a shared receipt atomically. Duplicate delivery cannot credit twice. Changed balances and late payments for ineligible fees produce a REVIEW receipt without crediting the fee. REVIEW requires reconciliation/refund with the merchant; automatic refunds are not implemented.

Sandbox confirmations create TEST receipts and **never change real fee balances or admission status**. Institutions and authorized payers can access payment history and printable receipts. Knowing an order ID alone grants no access. Pending manual proofs must be reviewed before enabling Online. Switching back to Manual does not invalidate an already initiated online payment; a new manual proof for that same unresolved fee is blocked until it is resolved.

### Mobile fee payment

The student/staff and parent apps fetch current payment options for the selected challan before opening a payment form. Online mode does not require manual destination accounts. Parents retain the selected linked child's `studentId` on both options and creation requests. Manual mode keeps its existing receipt-proof form.

Easypaisa initiation and status checks use the app's authenticated API client. JazzCash handoff is currently denied. Its retained native-checkout infrastructure supports a five-minute, single-use capability issued only after ordinary payer authorization; the following describes that infrastructure, not an enabled JazzCash flow. The browser URL contains no login token or merchant credentials; the cache stores only the payment reference under a hash of the capability. Browser GET/HEAD cannot initiate payment. POST consumes the capability atomically, rechecks gateway availability and claims the existing payment once before rendering the hosted-provider form. The provider's signed response remains mandatory for settlement. This capability never creates a browser login session.

Apps refresh payment status when returning from the provider, expose a **Check status** action and refresh receipts/balances after confirmation. Backgrounding the app never cancels an attempt or aborts its server-side processing. A foreground return can verify status while the original initiation request is still resolving; it never starts another debit. A return during an existing status query queues a fresh verification afterward. Hosted-browser lifetime does not hold the payment-verification lock. Apps poll pending attempts every five seconds while active, and pause polling in the background. Authenticated foreground Easypaisa inquiries have a one-second per-attempt cooldown; ordinary inquiries retain a five-second cooldown across replicas. Provider settlement timing can still leave an attempt Pending temporarily. Late request failures or stale Pending replies cannot replace an already verified receipt.

On a fee-screen reload, the apps use authenticated payment history to restore an initiated pending attempt for the current payer/linked child and check its status without another initiation. Pending attempts are reused rather than starting another debit. A completed payment remains recorded in fee balances and receipts even if the mobile process was terminated. Deploy this backend before distributing app binaries containing these mobile changes. No new database migration or payment environment variable is required for this handoff; it uses the existing Valkey service. Wallet notifications and OTP/approval screens are controlled by the merchant's enabled provider product, not by this app.

## Implemented provider contracts and limits

| Provider | Sandbox adapter | Required merchant confirmation |
| --- | --- | --- |
| JazzCash | Hosted MWALLET checkout, HMAC-SHA256 browser return, merchant-owned SOAP notification endpoint | Issued checkout URL, accepted fields, WSDL registration, actual notification payload and padded acknowledgement hashing |
| Easypaisa | REST **v4 Mobile Account without RSA** initiation and authenticated transaction inquiry | Merchant must explicitly support this product/version, credentials, approved endpoints and actual response fields/statuses |

This Easypaisa adapter is not a v5 RSA, QR or hosted-checkout adapter. The public integration portal did not expose the current downloadable merchant contract during research. The v4 vendor guide was available through mirrored copies; obtain the current merchant-issued specification and sanitized sandbox response fixtures before enabling production. Do not send this adapter's requests to a v5 endpoint.

The former JazzCash form included `pp_Password` in the payer's browser. That credential-bearing form has been removed, and new initiation/native handoff fail closed. Signed callbacks for historical attempts remain supported. Obtain merchant-specific official documentation and implement a supported server-to-server or credential-free hosted flow before re-enabling checkout; an endpoint override does not enable it. Do not log merchant credentials, checkout fields or notification bodies.

The merchant-owned JazzCash SOAP contract and acknowledgement require provider acceptance; local tests do not certify them. Register server notifications before live use. JazzCash status inquiry is **not implemented**: a closed browser depends on provider notification delivery and merchant reconciliation. The unsigned Easypaisa webhook cannot mark a fee paid; the background worker uses authenticated inquiry instead.

Sources used for contract research:

- [Official JazzCash integration examples](https://payments.jazzcash.com.pk/SandboxDocumentation/index.html) and [hashing/IPN documentation](https://sandbox.jazzcash.com.pk/SandboxDocumentation/v4.2/features.html). The official published HMAC example is a regression fixture.
- [Official Easypaisa Integration Guides portal](https://easypay.easypaisa.com.pk/easypay-merchant/faces/pg/site/IntegrationGuides.jsf). Vendor-authored older reference copies: [REST without RSA guide](https://www.scribd.com/document/512029435/Easypaisa-REST-APIs-without-RSA-Integration-Guide), [Merchant v4.1.2 guide](https://pdfcoffee.com/easypaisa-merchant-integration-guide-v412-pdf-free.html). These copies do not establish the currently issued merchant contract.

## Server configuration and migration

Apply the normal migration runner, `npm run db:migrate:production`, during an approved deployment, before running the updated application. New forward migration `0077_online_payment_modes.sql` is registered after `0076`; it adds mode, initiation/closure tracking, original portal origin and a production provider-reference uniqueness index. It preserves records and can be replayed safely. No migrations were run against an external database here.

Keep secrets outside Git. Configure the following variables on both app replicas; Compose and its release override include a single payment reconciliation worker:

```dotenv
PAYMENT_PUBLIC_ORIGIN=https://your-registered-payment-host.example
# Preserve the existing stable credential encryption secret across releases.
STREAMING_CREDENTIALS_SECRET=
CRON_SECRET=

# Optional endpoint overrides for the supported provider contracts.
# Blank/unset values use the built-in sandbox/production URLs below.
JAZZCASH_SANDBOX_CHECKOUT_URL=
EASYPAISA_SANDBOX_INITIATE_URL=
EASYPAISA_SANDBOX_INQUIRY_URL=

JAZZCASH_CHECKOUT_URL=
EASYPAISA_INITIATE_URL=
EASYPAISA_INQUIRY_URL=
```

The endpoint allowlist permits `sandbox.jazzcash.com.pk` / `payments.jazzcash.com.pk` and `easypaystg.easypaisa.com.pk` / `easypay.easypaisa.com.pk`, separately for sandbox and production. Easypaisa requires `/easypay-service/rest/v4/initiate-ma-transaction` and `/easypay-service/rest/v4/inquire-transaction`. Redirects, arbitrary hosts, HTTP provider endpoints and oversized responses are rejected. Confirm newly issued hosts before changing this policy.

Default URLs use the matching environment host above. JazzCash checkout uses `/CustomerPortal/transactionmanagement/merchantform/`; Easypaisa uses the two REST v4 paths above. Existing valid endpoint overrides remain supported. Production readiness means complete saved credentials, an enabled gateway and a valid supported endpoint; it does not certify merchant credentials with the provider. Providers validate credentials when payment requests are submitted. Existing saved production credentials become available on deployment without being re-entered or approved by a platform admin.

In Institution Settings → Payments, select Online, enter merchant credentials, leave **Enable this gateway** checked and save. This saves the credentials and activates Online payments atomically. Saving a disabled gateway preserves the current mode. Pending manual submissions must be reviewed before switching to Online; a rejected switch leaves both the existing credentials and mode unchanged. JazzCash requires merchant ID, password and integrity salt. Easypaisa requires store ID, account number, API username and password. Blank secret fields preserve existing secrets only for the same merchant/environment; re-enter secrets when changing either. API clients can request the same behavior with `activateOnline: true` in the gateway save request; older clients retain their existing save behavior.

Register these URLs under `PAYMENT_PUBLIC_ORIGIN` with JazzCash:

- Browser return: `/api/payments/jazzcash/return`.
- Merchant SOAP notifications: `/api/webhooks/jazzcash/soap`; GET serves the WSDL, POST handles signed notifications. Its exact contract must be accepted by the merchant onboarding team.

The reconciliation worker calls `POST /api/cron/payment-reconciliation` with `Authorization: Bearer <CRON_SECRET>` approximately every minute. It checks up to 12 pending Easypaisa attempts from the last seven days with bounded concurrency and per-attempt throttling. One worker is sufficient for both app replicas; initiation claims and settlement remain database-coordinated. Monitor failures, queue growth and provider settlement reports. Requests older than seven days need explicit operational reconciliation; they are not silently marked unpaid.

An attempt may be initiated once. A lost response or ambiguous timeout must not trigger another debit. Unstarted attempts can be replaced after expiry; initiated unresolved attempts remain blocked even after 30 minutes. The sandbox checkout offers a reset for unresolved test attempts only. Production unresolved attempts require verification with the provider. Credentials snapshots are retained encrypted for verification and must be included in the organization's data-retention/security policy.

## Provider integration verification

1. Obtain sandbox merchant accounts and the current issued integration guides. Confirm the exact products above, callback fields and SOAP contract with each provider.
2. Test monthly and admission flows, both enabled providers, each provider alone, parent access, tenant denial, mode switching, credential rotation and printable histories.
3. Exercise success, rejection, pending, timeout, browser closure, delayed notifications, duplicate callbacks, altered amounts/signatures and inquiry recovery. Compare every receipt with the sandbox merchant portal. Confirm sandbox receipts leave real balances unchanged.
4. Verify the reconciliation worker and provider notification retry delivery on the intended public HTTPS callback host. No native mobile app checkout UI was changed in this website task.
5. Enter provider-issued production credentials in the institution's payment settings, enable the gateway and save. Online payments activate in the same save. No additional platform activation is required. Verify provider responses, ledger entries, receipts and merchant settlement using provider-approved test procedures.

To disable new Online payments, switch the institution to Manual. Keep callbacks, credential encryption keys and the worker available for in-flight payments. Do not drop payment tables/columns or delete attempts during rollback. An old binary that ignores payment mode must not receive new payment submissions; prefer reverting the UI while retaining mode guards and verification handlers.

## Local validation

`npm run verify:payments` uses a disposable PGlite database, the actual migration chain and mocked provider HTTP. It does not read `.env` or contact banks. It covers migration replay, encrypted configuration, production locks, tenant ownership, fixed HMAC vectors, tampering, duplicate settlement, sandbox isolation, single initiation, inquiry validation, late-payment review, provider-reference rollback and admission settlement. The same suite is included in `npm run verify:local` alongside existing regression checks. Tests also use a non-UTC database timezone to detect naive timestamp comparison errors.

No browser/device end-to-end test, real bank sandbox payment, production PostgreSQL concurrency test, Docker image build or deployment is implied by these local tests. Obtain merchant sandbox access and complete the acceptance checklist before describing the integration as ready for live collections.

Actual local results on 27 October 2026: all 18 payment test cases passed; the complete local verification gate passed, including type checking, tenant/role boundaries, campus admissions, fee billing and the existing backup regression checks. Repository lint reported zero errors and 200 existing warnings. The separate mobile backend parity suite passed all nine scenario groups. The optional native PostgreSQL backup integration check was skipped because no isolated PostgreSQL test service was configured. Tests used only disposable fixtures and mocked provider traffic.
