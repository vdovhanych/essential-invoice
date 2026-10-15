# API Reference

All endpoints require JWT authentication unless noted otherwise. Include the token in the `Authorization: Bearer <token>` header.

Requests share a limit of **1,000 requests per IP per 15 minutes**, except `/api/health`. Login additionally permits 10 requests per IP per 15 minutes, and forgot-password permits 5. Exceeding a limit returns HTTP 429 with `Retry-After`; allowances reset automatically. See [request limits and proxies](configuration.md#request-limits-and-proxies).

## Authentication

- `POST /api/auth/register` - Register new user (sends welcome email if global SMTP configured)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password (requires current password)
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `DELETE /api/auth/me` - Delete account (requires password confirmation)
- `GET /api/auth/me/logo` - Get user logo image
- `POST /api/auth/me/logo` - Upload user logo (multipart form data)
- `DELETE /api/auth/me/logo` - Delete user logo

Both `GET /api/auth/me` and `PUT /api/auth/me` responses include read-only `vatFilingStatus` (`payer`, `identified`, `nonpayer`, or `null` before taxpayer setup), alongside `vatPayer`. This exposes only the saved registration status, not the taxpayer profile. Update that status through `/api/vat-filings/profile`; ordinary profile updates preserve it. The Settings VAT filing card is visible when `vatPayer` is true or `vatFilingStatus` is `identified`. Accountant ZIP exports remain available to all users.

## Clients

- `GET /api/clients` - List all clients (each row also carries `invoiceCount`, `totalPaid`, `totalInvoiced` and `openBalance`, the latter two normalised to CZK for the contacts ranking)
- `GET /api/clients/:id` - Get client details
- `GET /api/clients/:id/invoices` - Get client's invoices
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

## Invoices

- `GET /api/invoices` - List invoices (filters: status, clientId, from, to)
- `GET /api/invoices/:id` - Get invoice with items
- `GET /api/invoices/:id/pdf` - Download PDF
- `GET /api/invoices/:id/isdoc` - Download unsigned ISDOC 6.0.2 XML (CZK/EUR)
- `POST /api/invoices` - Create invoice (items require positive `quantity`, non-negative `unitPrice`; `vatRate` 0–100; `currency` CZK or EUR)
- `PUT /api/invoices/:id` - Update invoice (content edits only on drafts; `status` changes must follow legal transitions: draft→sent/cancelled, sent→paid/overdue/cancelled, overdue→paid/cancelled — paid and cancelled are terminal)
- `DELETE /api/invoices/:id` - Delete draft invoice
- `POST /api/invoices/:id/send` - Send via email (rejected with 400 for `paid` and `cancelled` invoices — a settled invoice must never reach the client again). Accepts optional `customMessage` and `customSubject` overrides (used e.g. by AI-drafted payment reminders)
- `POST /api/invoices/:id/mark-sent` - Mark as sent manually (without sending email)
- `POST /api/invoices/:id/mark-paid` - Mark as paid
- `POST /api/invoices/:id/cancel` - Cancel invoice
- `GET /api/invoices/:id/preview` - Preview invoice email before sending
- `POST /api/invoices/preview` - Render unsaved invoice form data as `{ pdfBase64 }` using the same PDF template. Accepts optional owner-scoped `invoiceId` (to retain an existing number), optional `clientId`, date-only `issueDate`/`dueDate`/`deliveryDate`, `currency`, `vatRate`, `notes`, and `items` (up to 500). Missing clients/dates and blank descriptions are displayed as draft placeholders; quantities/prices may be zero while editing. Invalid supplied values return 400, inaccessible clients/invoices return 404. Calculates amounts on the server and loads the authenticated supplier profile. Creates no invoice, allocates no number, and sends no email; EUR conversion may populate the exchange-rate cache. Unsaved new invoices show a QR placeholder until a payment reference exists. Responses use `Cache-Control: no-store`.

EUR invoices include `exchangeRate` (CNB rate at issue date) and `totalCzk` (converted CZK equivalent) in responses. These are auto-fetched from the Czech National Bank when the invoice is created or updated. Dashboard totals and paušální daň tracking use the CZK equivalent for EUR invoices.

### Per-line VAT

Invoice and recurring-template items accept `vatRate` (0–100, up to two decimal places), `vatTreatment` (`standard`, `exempt`, `reverse_charge`, `eu_service`), `vatReason` (up to 300 characters), and `vatCode` (domestic reverse-charge supply code, up to 20 characters). Omitted line rates inherit the invoice/template `vatRate`; omitted treatment means `standard`. Invoice-level `vatRate` remains the default, not a representation of mixed rates.

Exempt lines require a nonblank reason/legal reference and a zero rate (or no rate). EU-service lines (`eu_service`) are normalized to a zero rate and zero supplier VAT; an optional reason can provide a legal reference. The filing workflow uses the distinct EU-service classification, never the domestic reverse-charge supply code. Reverse-charge lines require a numeric supply code, optionally containing a decimal point; their rate records the applicable rate but supplier VAT is zero. Applicability of the chosen treatment/code remains an accounting decision. Standard 0% is distinct from exemption. Invoice responses expose the stored line `vatAmount` and tax-exclusive `total`. The server calculates all monetary totals and ignores submitted line totals/taxes.

Line bases are rounded to two decimal places, grouped by rate and treatment, then VAT is rounded per group. Cumulative allocation distributes group VAT to lines without losing cents. Old single-rate invoices retain their recorded totals during migration. Recurring generation uses the same calculation; the template list includes its calculated `total`.

`deliveryDate` records the tax-point date and defaults to `issueDate`. Include `items` when editing an invoice's VAT default, currency, or issue date, or a recurring template's VAT default. An omitted VAT default on edit preserves the saved default. Recalculation refreshes EUR conversions; switching to CZK clears them.

### Accountant export

`GET /api/exports/accountant?from=2026-09-01&to=2026-09-30&basis=issue` downloads a ZIP. Both ISO calendar dates are required and inclusive; `basis` is `issue` (default) or `tax` (delivery date, falling back to issue date). Maximum range: 367 days; maximum selection: 500 documents and 100 MB of uncompressed files. Each process allows one active export per user.

The package includes sent, overdue and paid invoices plus all expenses in the period. Draft/cancelled invoices and recurring templates are excluded. Files:

- `issued-invoices.csv`: header totals, counterparties, dates, status, currency, stored exchange rate/CZK total, and paths to PDFs/ISDOC.
- `issued-lines.csv`: item quantities/prices, VAT rates, treatments, reasons, supply codes and amounts.
- `issued-vat.csv`: issued bases and VAT grouped per invoice/rate/treatment; currencies remain separate.
- `received-expenses.csv`: expense-level amounts/VAT, supplier data and attachment paths. Input-VAT deductibility is not inferred.
- `issued/`: invoice PDFs and ISDOC files; `received/`: original expense attachments.
- `dph/summary.csv`: CZK bases and recorded VAT by issued/received direction, rate and treatment, with converted/excluded group counts and conversion completeness status.
- `dph/register.csv`: one row per document/rate/treatment, original and CZK amounts, dates and fallback provenance, counterparty, internal and tax-document references, VAT reasons/supply codes, and source file paths relative to the ZIP root. A missing supplier document number stays empty rather than using the internal expense number.
- `dph/issues.csv`: stable issue codes, document IDs/references and Czech/English review messages for missing data, unconfirmed classification/deductibility, special treatments, conversion problems and inconsistent totals.
- `dph/README.txt`: bilingual interpretation, selection and rounding guidance.
- `manifest.json` and `README.txt`: counts, period, selection rules and file-format notes.

CSV uses UTF-8 with BOM, semicolons, quoted cells and decimal points. Formula-like text is prefixed with an apostrophe. Filenames are sanitized and include document IDs. Missing EUR conversions stay empty in expense CSVs. No VAT return/control-statement XML, ISDOC import or ISDOCX is included.

The DPH preparation files use the same document selection and date basis as the main export; issue-date selection is flagged for review. Missing tax-point dates fall back to issue dates and are flagged. Previously auto-filled dates cannot be distinguished from confirmed dates. Expense tax-point dates do not establish a deduction claim period. Received treatment and every document's jurisdiction are `unclassified`; received deduction status is `unreviewed`. Received amounts are **recorded VAT**, not deductible input VAT, and no VAT payable is calculated. Missing counterparty DIČ is a review item, not an assertion that every transaction requires DIČ.

DPH CZK conversion uses the stored positive EUR/CZK rate (1 for CZK), rounding base and VAT separately per invoice line as in ISDOC, or per expense rate bucket. Summary amounts sum the rounded register amounts, preserving recorded VAT rather than recalculating tax from rates. Missing/invalid rates or malformed groups retain original data but leave CZK amounts blank and exclude the group from CZK sums. Affected summary rows have `czk_totals_status=incomplete` and an `excluded_group_count`; if no group was convertible, sums are blank, not zero. `complete` describes conversion coverage only, not filing readiness. Stored-total mismatches are flagged for review; the register still shows the recorded bases and VAT. Existing invoice/ISDOC validation continues to abort the ZIP on fatal errors, including missing issued-invoice EUR rates. DPH reports do not bypass it.

Expense DPH rows use the stored `vat_breakdown` buckets, preserving mixed rates and supplier-recorded rounding. Only legacy expenses without a breakdown fall back to the document-level rate, base and VAT.

The manifest is format version 2 and includes `dphPreparation.issueCount`, `excludedGroupCount`, `inputVatDeductibility: "unreviewed"`, and `filingXml: false`. Empty periods still include all DPH files with CSV headers and zero document counts. Review advances, corrective documents, foreign transactions and transactions outside the application separately; the pack does not model them as filing data.

ISDOC uses the official [6.0.2 schema](https://isdoc.github.io/), ordinary invoice document type, CZK local amounts and EUR foreign amounts when applicable. It requires stored totals to reconcile and a valid exchange rate for EUR invoices; failure aborts the package with a specific error rather than silently omitting a document. The standard's supply-code field and VAT note carry domestic reverse charge and exemption reasons. Unknown structured address fields are left empty while preserving the existing free-form address; supplier/client details come from the current profiles, as in PDFs. Downloads do not alter invoice status or send email.

Expense attachments are fetched only if the expense's database row version still matches the selected summary. A concurrent edit or deletion aborts the export with `409`; retry to export the updated expense. This prevents combining old expense totals with a replacement receipt.

Errors: `400` invalid dates/tax data, missing EUR rate or inconsistent invoice totals; `404` invoice absent/not owned; `409` expense changed before its attachment was fetched; `413` selection too large; `429` another export running. Standard authentication applies to every download; files are sent with `Cache-Control: no-store`.

## Recurring Invoices

- `GET /api/recurring-invoices` - List all recurring invoice templates
- `GET /api/recurring-invoices/:id` - Get template with items
- `POST /api/recurring-invoices` - Create recurring template
- `PUT /api/recurring-invoices/:id` - Update template
- `DELETE /api/recurring-invoices/:id` - Delete template
- `POST /api/recurring-invoices/:id/toggle` - Toggle active/paused
- `POST /api/recurring-invoices/:id/generate-now` - Generate invoice immediately

## Expenses

- `GET /api/expenses` - List expenses (filters: status, clientId, from, to)
- `GET /api/expenses/:id` - Get expense details
- `GET /api/expenses/:id/file` - Download attached file
- `POST /api/expenses` - Create expense with optional file upload (EUR expenses store `exchangeRate`/`totalCzk` from the CNB rate on the issue date)
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/:id/mark-paid` - Mark as paid
- `POST /api/expenses/:id/cancel` - Cancel expense
- `POST /api/expenses/:id/mark-unpaid` - Mark expense as unpaid

## Payments

- `GET /api/payments` - List payments (filter: matched)
- `GET /api/payments/unmatched` - List unmatched payments
- `GET /api/payments/:id/matches` - Get potential invoice matches
- `POST /api/payments/:id/match` - Match to invoice (payment and invoice currency must match)
- `POST /api/payments/:id/unmatch` - Remove match
- `DELETE /api/payments/:id` - Delete unmatched payment
- `POST /api/payments/check-emails` - Check for new payments from email

## ARES

- `GET /api/ares/lookup/:ico` - Lookup company by ICO
- `GET /api/ares/validate/:ico` - Validate ICO checksum

## Dashboard

- `GET /api/dashboard` - Get dashboard statistics (`stats` includes `outstandingAmount` and `overdueAmount`, both CZK-normalised). `monthlyRevenue` and `monthlyExpenses` cover every month the user has data for (not a rolling window) so the chart's year picker can show whole calendar years; both series are bucketed by payment date and normalised to CZK
- `GET /api/dashboard/quick-stats` - Get quick stats for header

## Settings

- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-smtp` - Test SMTP connection
- `POST /api/settings/test-imap` - Test IMAP connection

## AI

- `GET /api/ai/status` - Check AI feature availability
- `POST /api/ai/tax-advisor` - Czech tax advisor chat (personalized with the user's VAT status, paušální daň settings, and revenue)
- `POST /api/ai/extract-expense` - Extract expense fields from an uploaded document (PDF/JPEG/PNG, max 5MB; returns `extracted` object)
- `POST /api/ai/draft-reminder` - Draft a payment reminder email for a sent/overdue invoice (returns `subject` and `body`). Accepts an optional `tone` of `auto` (default, chosen from how overdue the invoice is), `friendly`, `neutral` or `firm`

## VAT filing workspace

All `/api/vat-filings` routes require authentication and operate only on the current user's records. See [VAT filings](vat-filings.md) for the 2026 supported-case matrix, official sources and row mappings. These routes are separate from the accountant ZIP; they never submit to the tax authority.

| Method and path | Behavior |
| --- | --- |
| `GET /api/vat-filings/workspace` | Taxpayer profile, VAT-payer flag and normalized documents with source fingerprints and reviewed metadata, plus editable `profileDefaults` and `profileSourceAddress` from the existing user profile (not confirmed filing data). Attachments and credentials are excluded. |
| `GET /api/vat-filings/code-lists` | Bundled official offices, branches, countries and 2026 activity codes for editing. |
| `PUT /api/vat-filings/profile` | Replace the filing profile; synchronizes `vat_payer` while preserving unrelated company settings. |
| `PUT /api/vat-filings/documents/:direction/:id` | Save explicit tax review; direction is `issued` or `received`. Requires current source `fingerprint`. Received documents may include `buckets`; the breakdown and metadata are saved atomically against the updated fingerprint, preserving historical totals. |
| `PUT /api/vat-filings/expenses/:id/breakdown` | Save `{ buckets, fingerprint }`; requires sums to match existing base/tax/total exactly. |
| `GET /api/vat-filings/exchange-rate?date=YYYY-MM-DD` | Existing CNB EUR/CZK service, for an explicitly selected tax date. |
| `POST /api/vat-filings/review` | Calculate and validate `{ period, type, mode }`, returning `review`, all-form `applicability`, `snapshotHash`, `previousId`, `changed`, and changed profile/document references. |
| `POST /api/vat-filings/versions` | Same parameters plus preview `snapshotHash`; revalidate and persist a new immutable version; returns 201 with `id` and `created_at`. |
| `GET /api/vat-filings/versions` | List saved versions for the current user. |
| `GET /api/vat-filings/versions/:id` | Saved taxpayer/document snapshot, calculation and validation. |
| `GET /api/vat-filings/versions/:id/xml` | Original stored UTF-8 bytes, `application/xml`, attachment, `Cache-Control: private, no-store`. |

`period` accepts `2026-01` through `2026-12` or `2026-Q1` through `2026-Q4`. `type` is `DPHDP3`, `DPHKH1` or `DPHSHV`. `mode` defaults to `original`; `replacement` is supported only for return/KH before the ordinary deadline. Unsupported subsequent/supplementary workflows cannot generate XML.

Profile fields: `status` (`nonpayer`, `payer`, `identified`), `personType` (`individual`, `legal`, with legal persons blocked at review), `frequency` (`monthly`, `quarterly`), `vatId`, `firstName`, `lastName`, `street`, `houseNumber`, optional `houseOrientation`, `city`, `postcode`, `taxOffice`, `taxOfficeBranch`, `activityCode`, `email`, and `effectiveFrom` (`YYYY-MM-DD`, or empty while completing setup). Identity and code-list business validation occurs during review, allowing incomplete profiles to be saved for later completion.

Document review fields: `classification` (`domestic`, `domestic_reverse_charge`, `eu_service`, `nonpayer_domestic`, `unsupported`), `country`, `vatId`, `counterpartyType` (`business`, `consumer`), `documentKind` (`ordinary`, `advance`, `correction`, `other`), `taxPoint`, `receivedDate`, `reference`, `deduction` (`unknown`, `full`, `none`, `partial`), `deductibleTax` (CZK), `claimPeriod`, `reverseChargeCode`, `exchangeRate`, `exchangeRateDate`, `exchangeRateSource` (`cnb`, `recorded`) and current source `fingerprint`. Dates use `YYYY-MM-DD` or empty strings where inapplicable. The server sets `reviewedFingerprint`; it does not accept it as proof of review from the caller. Unsupported choices save successfully but produce actionable blockers.

Malformed input returns 400, absent or other-user records 404, stale source/preview 409, and blocked filing or mismatched historical breakdown totals 422. Reviews distinguish `blocker` and `warning`, include document/field references, calculated return rows, statement sections and reconciliation checks. XML schema failures block generation. Saved validation identifies local XSD validation separately from `epoImportVerified: false`; it never asserts submission.

The `unpaid_adjustment` blocker checks earlier domestic deductions against the §74b deadline and payment date, including historical periods and the later repayment period. Quarterly payers may settle through the applicable quarter end. Paid records without a valid payment date remain flagged; EU-service and domestic reverse-charge purchases are excluded from this check. See [the correction limitations](vat-filings.md#corrections-and-explicit-limitations).

Issued invoices with payments before their tax point are included for review in the payment period, even if the supply is later. Reviewed ordinary invoices produce `advance_payment` blockers; unreviewed sources must first be reviewed. Unknown dates on positive linked payments also require review rather than being excluded by period selection. These payments are not converted into supported advance-tax rows.

### Expense recorded VAT

Expense POST/PUT accepts optional `vatBreakdown: [{ rate, base, tax }]`. Values have at most two decimals; negative/non-finite values are rejected. The server sums recorded base and VAT rather than recomputing supplier VAT, and maintains EUR `exchange_rate`/`total_czk` through the existing conversion service. Responses expose `vatBreakdown`. Legacy single-rate requests remain supported. Financial edits to an existing mixed-rate expense must include the breakdown; they cannot silently flatten its tax buckets. Changing tax-relevant source data invalidates the filing review fingerprint.

Invoice and expense list/detail responses return `issueDate`, `dueDate`, and `deliveryDate` as date-only `YYYY-MM-DD` values (nullable where applicable), preserving the PostgreSQL calendar date rather than serializing a local-midnight timestamp into the previous UTC day. Lifecycle timestamps such as `paidAt` retain their timestamp representation.
