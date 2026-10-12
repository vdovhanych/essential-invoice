export type FilingType = 'DPHDP3' | 'DPHKH1' | 'DPHSHV';
export const filingTypes: FilingType[] = ['DPHDP3', 'DPHKH1', 'DPHSHV'];
export type FilingMode = 'original' | 'replacement';
export type Classification =
  | 'domestic'
  | 'domestic_reverse_charge'
  | 'eu_service'
  | 'nonpayer_domestic'
  | 'unsupported';
export interface FilingProfile {
  status: 'nonpayer' | 'payer' | 'identified';
  personType: 'individual' | 'legal';
  frequency: 'monthly' | 'quarterly';
  vatId: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  houseOrientation?: string;
  city: string;
  postcode: string;
  taxOffice: string;
  taxOfficeBranch: string;
  activityCode: string;
  email: string;
  effectiveFrom: string;
}
export interface TaxBucket {
  rate: number;
  base: number;
  tax: number;
}
export interface FilingMetadata {
  classification: Classification;
  country: string;
  vatId: string;
  counterpartyType: 'business' | 'consumer';
  documentKind: 'ordinary' | 'advance' | 'correction' | 'other';
  taxPoint: string;
  receivedDate: string;
  reference: string;
  deduction: 'unknown' | 'full' | 'none' | 'partial';
  deductibleTax: number;
  claimPeriod: string;
  reverseChargeCode: string;
  // Reviewed tax currency conversion, separate from dashboard's issue-date conversion.
  exchangeRate: number;
  exchangeRateDate: string;
  exchangeRateSource: 'cnb' | 'recorded';
  reviewedFingerprint: string;
}
export interface FilingDocument {
  id: string;
  direction: 'issued' | 'received';
  number: string;
  sourceNumber: string;
  issueDate: string;
  deliveryDate: string;
  dueDate: string;
  paidAt: string;
  status: string;
  currency: string;
  base: number;
  tax: number;
  total: number;
  exchangeRate: number | null;
  clientId: string | null;
  clientName: string;
  clientVatId: string;
  payments?: { date: string; amount: number }[];
  buckets: TaxBucket[];
  lines: {
    treatment: string;
    code: string;
    base: number;
    tax: number;
    rate: number;
  }[];
  metadata: FilingMetadata | null;
  fingerprint: string;
}
export interface FilingSnapshot {
  profile: FilingProfile | null;
  vatPayer: boolean;
  documents: FilingDocument[];
}
export interface FilingIssue {
  severity: 'blocker' | 'warning';
  code: string;
  documentId?: string;
  direction?: 'issued' | 'received';
  field?: string;
}
export interface ReturnRow {
  base: number;
  tax: number;
  documents: string[];
}
export interface StatementRow {
  section: string;
  attributes: Record<string, string | number>;
  documents: string[];
}
export interface FilingReview {
  period: string;
  type: FilingType;
  mode: FilingMode;
  schemaVersion: string;
  applicable: boolean;
  reason: string;
  issues: FilingIssue[];
  rows: Record<string, ReturnRow>;
  statement: StatementRow[];
  documents: FilingDocument[];
  reconciliation: {
    code: string;
    expected: number;
    actual: number;
    passed: boolean;
  }[];
}
