# Czech VAT filing XML

The VAT filing workspace at `/vat-filings` prepares XML for manual import, checking and submission in MOJE daně / EPO. An export is never a submission. This is a bounded implementation for Czech individual freelancers, with explicit transaction review, local XSD validation and immutable saved versions.

## How to use

1. Open **Settings → Exports → VAT filings** (Czech: **Podání DPH**).
2. The first visit opens **Taxpayer**, prefilled from the existing user name, DIČ, email, VAT-payer flag and recognizable Czech address. Saved filing values are preserved, and the original free-form address remains visible for checking. Explicitly confirm registration status, effective date, monthly/quarterly frequency, registered personal identity, tax office/branch, address, contact email and current CZ-NACE activity code. A sole trader's VAT ID uses the assigned personal tax identifier, not their IČO. Saving status synchronizes the existing VAT-payer flag without replacing unrelated profile fields.
3. In **Documents**, review each transaction's country, VAT ID, business/consumer status, tax classification, document kind and actual tax point. Received documents additionally need receipt date and an explicit deduction decision. Full deductions require their CZK amount and claim period. Unknown historical classifications are not treated as domestic by default.
4. Enter supplier-recorded bases and VAT by rate for expenses. Their amounts must match the historical totals. The workspace saves an edited breakdown and its reviewed tax metadata together in one transaction, preserving those totals; correct erroneous amounts in the source expense editor. The expense creation/editing form also supports mixed rates and recorded-tax rounding.
5. For EUR, confirm a tax-point exchange rate. **Get CNB rate** reuses the existing CNB cache/service. The reviewed filing rate is separate from the dashboard's issue-date conversion. Compare converted amounts with the actual VAT evidence, especially Czech VAT stated by a supplier on an EUR document.
6. Choose the period and form, then **Calculate and validate**. Review applicability, contributing documents, blockers, warnings, return rows/statement sections and cross-form comparisons. Resolve blockers through the linked records.
7. **Save new version and download XML** validates again and saves the exact XML and snapshots transactionally. Import the XML into EPO and review it there. Use **Saved versions** to inspect or download previous bytes; regeneration always creates a new version.

## Verified sources and applicability

Research date: **8 September 2026**. The implementation intentionally accepts only **2026 monthly or calendar-quarter periods**. Extending this interval requires rechecking form instructions, statutory changes, code-list validity and fixtures, even if EPO continues accepting the same XSD. A schema's publication date is not the beginning of every transaction's legal applicability.

| Filing | Official structure version | Publication | Instructions |
| --- | --- | --- | --- |
| Přiznání k DPH, `DPHDP3` | `03.01.03` | 9 March 2026 | 25 5412, version 22 |
| Kontrolní hlášení, `DPHKH1` | `03.01.14` | 9 March 2026 | Current EPO structure annotations and KH instructions |
| Souhrnné hlášení, `DPHSHV` | `02.01.04` | 29 October 2024 | 25 5525, version 7 (2026) |

Primary sources:

- [EPO structure register](https://mojedane.gov.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_seznam.faces).
- [VAT return structure and field/row descriptions](https://adisspr.mfcr.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_detail.faces?zkratka=DPHDP3).
- [Control statement structure and field/section descriptions](https://adisspr.mfcr.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_detail.faces?zkratka=DPHKH1).
- [Recapitulative statement structure](https://adisspr.mfcr.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_detail.faces?zkratka=DPHSHV).
- [2026 return instructions, version 22](https://financnisprava.gov.cz/assets/tiskopisy/5412_22.pdf); [2026 SH instructions, version 7](https://financnisprava.gov.cz/assets/tiskopisy/5525_7.pdf).
- [Current KH instructions and amendments](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/kontrolni-hlaseni-dph/soubory-ke-stazeni); [KH grouping examples and deduction-period explanations](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/kontrolni-hlaseni-dph/caste-dotazy-a-odpovedi).
- [Who files KH](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/kontrolni-hlaseni-DPH/kdo-podava-kontrolni-hlaseni); [KH frequency](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/kontrolni-hlaseni-dph/kdy).
- [SH services and frequency](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/informace-stanoviska-a-sdeleni/souhrnna-hlaseni/podavani-souhrnneho-hlaseni-od-roku-2010-a-dale).
- [EPO code-list interface](https://mojedane.gov.cz/dpr/adis/idpr_pub/epo2_info/rozhrani_ciselniku.faces). Bundled lists contain offices, office branches, countries, activities and domestic reverse-charge codes. CZ-NACE codes changed for 2026; validity is checked, not just numeric format. Some queries are capped at 300 entries: the complete activity list must use `C=okec` without the limiting `M` parameter.

Unmodified official XSDs, a source/version/SHA-256 manifest and code-list snapshots live in `backend/src/services/vatSchemas/`. Their field names, including historically named attributes such as `obrat23` and `obrat5`, are retained exactly; these names do not imply current tax rates of 23% or 5%.

## Supported-case matrix

All cases require ordinary positive documents, explicit classification and registration unchanged throughout the selected period. Mixed **rates** are supported; mixed **tax regimes on one document** are blocked.

| Case | Taxpayer | Return rows | KH | SH | Selection |
| --- | --- | --- | --- | --- | --- |
| Domestic sales, ordinary 21% / 12% | Payer | 1 / 2 | A4 / A5 | None | Confirmed tax point |
| Domestic purchases, full deduction | Payer | 40 / 41 | B2 / B3 | None | Explicit claim period after receipt/tax-point conditions |
| Domestic purchases, no deduction | Payer or identified person | No deduction | No input entry | None | Retained for review; never assumed deductible |
| Domestic construction supplied, code 4 (§ 92e) | Both parties Czech payers | 25 | A1 | None | Confirmed tax point |
| Domestic construction received, code 4, 21% / 12% | Both parties Czech payers | 10 / 11; full same-period deduction 43 / 44 if eligible | B1 | None | Liability at tax point; optional full deduction in that same period |
| EU B2B services supplied (§ 9(1)), taxable by recipient, not exempt in destination | Payer or identified person | 21 for payer | None | Code 3, grouped per country/VAT ID | Confirmed service tax point |
| EU B2B services received from EU VAT-registered supplier, taxable at Czech 21% | Payer or identified person | 5; payer's full same-period deduction 43 if eligible | A2 for payer; no KH for identified person | None | Liability at tax point; optional full same-period deduction for payer |
| Ordinary domestic activity of nonpayer / identified person | Nonpayer or identified person | No ordinary filing | None | None | Explicit `nonpayer_domestic`; no charged output VAT or deductions |
| Empty period | Payer | Zero return | No KH | No SH | Registered period |

For natural persons, KH follows the VAT return frequency. For the supported **services-only** EU supplier, SH follows the payer's return frequency. Identified persons use monthly periods, have no deduction entitlement, never file KH, and generate a return only when they incur a liability. They may need SH without a return. Northern Ireland (`XI`) is not treated as an EU services destination.

Domestic A4/B2 detail is selected strictly **above CZK 10,000 including VAT**. Exactly CZK 10,000 is A5/B3. Ordinary sales to consumers belong to A5 even above the threshold; business sales above it require a Czech VAT ID. The total document amount determines the boundary. Mixed rates stay in one statement row. Detail rows require the original evidential number, correct dates and counterparty VAT ID. This implementation additionally requires a document number for all supported documents, including purchases aggregated in B3.

## Amounts, periods and reconciliation

- Source totals and supplier-recorded tax are never recomputed from VAT rates for ordinary domestic input VAT. Expense breakdown sums must exactly match the stored amount/VAT/total. Issued allocated line tax is preserved and grouped by rate.
- CZK filing amounts use two-decimal recorded values. EUR conversion uses the explicitly reviewed tax-date rate, with base and recorded tax converted separately per rate. A daily CNB rate may have an earlier publication date at weekends/holidays; it is the rate applicable on the selected tax date. Fixed/alternative recorded rates must be verified by the user against their tax records. Do not reuse dashboard or accountant-pack totals as a filing calculation.
- Reverse-charge acquisitions have zero supplier-charged tax. The calculation derives Czech self-assessment from each converted base and its confirmed Czech rate. `deductibleTax` is explicitly entered **in CZK** and must equal the full eligible tax; `none` requires zero and no claim period. Partial or coefficient-based deduction is not approximated as full deduction.
- The return emits whole-CZK row amounts (nearest whole crown after aggregation), then computes 46, 62, 63, 64 and 65 from the displayed rows. The XSD requires integer amounts. KH retains two decimals as permitted by its instructions. SH totals are grouped before rounding **up** to whole CZK as required by instructions version 7. SH and row 21 need not be identical after their different rounding operations.
- Reconciliation compares exact pre-whole-crown values of rows 1/2, 40/41, 10/11, 25 and 5 with the corresponding KH sections, and row 21 with SH code 3 before SH rounding. XML, review and comparisons all use the same calculation result. Reconciliation mismatches block all downloads.
- Unknown earlier records within the confirmed registration remain in the review queue. A source fingerprint detects changes in amounts, lines, counterparties, dates or payment state. Unreviewed records block instead of disappearing. Drafts are excluded with a warning; cancelled issued documents block pending a correction workflow.

## Corrections and explicit limitations

`original` maps to return/KH `B` and SH `R`. `replacement` maps to return/KH `O`: it replaces the entire original filing before its ordinary deadline. Generation after that deadline is blocked (25th of the next month, advanced over weekends and Christmas public holidays); the review still warns that the user must confirm the actual filing circumstances in EPO. A saved export is not evidence of a prior submission.

SH has no equivalent replacement mode. SH subsequent (`N`, cancellation/replacement rows), supplementary VAT returns (`D` / `E`, differences from the last assessed liability), subsequent KH (`N` / `E`, discovery date or tax-authority notice) and tax document corrections are explicitly unsupported. Do not pass a regenerated ordinary export off as one of these corrections.

The following require accountant processing and are not mapped to ordinary rows: advance/deposit and settlement documents; credit/debit notes and bad-debt corrections; partial/proportional/annual coefficient deductions; capital-goods adjustments and vehicle deduction caps; unpaid-invoice deduction reversals; imports/exports; intra-EU goods, triangulation/call-off stock; third-country services; exempt/zero-rate domestic supplies; OSS/IOSS/SME regimes; investment gold, margin schemes, real-estate special cases and reverse-charge codes other than construction code 4. The form's `unsupported` classification and special document kinds retain these as actionable blockers. Earlier unpaid deducted expenses are checked for the six-month overdue adjustment case and block because this correction workflow is absent.

Only Czech resident **individuals filing for themselves** are supported. Legal entities, groups, representatives, nonresident identities and registration changes inside a period are blocked. The taxpayer profile does not maintain a complete registration-history ledger. Nonpayer special liabilities are not implemented. Claims originating before 2026 and split claims across periods are unsupported. The app cannot detect transactions never entered into it: complete the ledger and disclose special cases rather than selecting an ordinary classification to bypass a blocker.

## Persistence and security

Migrations in `db/init.ts` add nullable taxpayer/document JSON metadata and expense VAT breakdowns. Historical expenses receive exactly one bucket with their recorded rate, base and tax. No classification, tax point, deduction decision or claim period is inferred. Existing document totals are unchanged. The extra `eu_service` issued/recurring line treatment has zero supplier VAT and stays distinct from domestic reverse charge in PDF and ISDOC output.

Versions persist the taxpayer/document snapshot, snapshot hash, period/type/mode, schema version, calculated rows/sections, issues, reconciliation, local XSD result and exact UTF-8 XML. Creation and review use repeatable-read transactions. A stale preview hash produces HTTP 409; validation blockers produce 422. Every select/update/download scopes ownership to the authenticated user, including joins. A PostgreSQL trigger rejects version updates. There is no version update/delete API; deleting the owning account still cascades as part of account erasure. Versions deliberately have no submitted status. Database administrator actions are outside this immutability boundary.

The snapshot currently contains the user's normalized ledger, including documents outside the chosen period, so source changes can conservatively mark an export as changed even when totals are unaffected. Binary attachments and credentials are excluded. Saved versions survive source document deletion. All downloads use the stored XML rather than recalculating it. These records contain personal tax identifiers: include them in protected database backups and do not enable request-body or XML/parser-error logging.

## Validation evidence

The automated suites validate representative domestic, mixed-rate, reverse-charge and EU cases against the actual bundled XSDs using `xmllint-wasm` (libxml2). Runtime checks use the same validator, with no tax-authority calls. Source/schema manifests and fixtures should be reviewed together when rules change.

EPO import/check was exercised with synthetic data on 8 September 2026; see the final verification notes in this repository's development documentation. Synthetic identifiers are not proof of registration, and EPO import acceptance is not tax-authority acceptance of a submitted filing. No submission was performed. Every saved version retains `epoImportVerified: false`: the application does not call EPO to validate that particular user's export.
