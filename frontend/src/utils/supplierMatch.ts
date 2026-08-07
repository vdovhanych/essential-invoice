interface MatchableClient {
  id: string;
  companyName: string;
  ico?: string | null;
}

/**
 * Normalize a company name for comparison: lowercase, strip diacritics,
 * punctuation, and Czech legal-form suffixes (s.r.o., a.s., ...)
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,]/g, '')
    .replace(/\b(spol s ro|sro|as|vos|ks|zs|zu|ops)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the client (supplier) matching extracted document data.
 * IČO match wins (unique company identifier); falls back to normalized
 * company name (exact, then substring containment either way).
 */
export function findSupplierClient<T extends MatchableClient>(
  clients: T[],
  supplierName: string | null,
  supplierIco: string | null
): T | undefined {
  if (supplierIco) {
    const ico = supplierIco.replace(/\D/g, '');
    if (ico) {
      const byIco = clients.find(c => c.ico && c.ico.replace(/\D/g, '') === ico);
      if (byIco) return byIco;
    }
  }

  if (supplierName) {
    const name = normalizeCompanyName(supplierName);
    if (name) {
      const exact = clients.find(c => normalizeCompanyName(c.companyName) === name);
      if (exact) return exact;

      return clients.find(c => {
        const clientName = normalizeCompanyName(c.companyName);
        return clientName !== '' && (clientName.includes(name) || name.includes(clientName));
      });
    }
  }

  return undefined;
}
