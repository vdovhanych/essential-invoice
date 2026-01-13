import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';

export const aresRouter: ReturnType<typeof Router> = Router();

interface AresResponse {
  ico: string;
  obchodniJmeno: string;
  sidlo?: {
    textovaAdresa?: string;
    nazevObce?: string;
    psc?: string;
    nazevUlice?: string;
    cisloDomovni?: number;
    cisloOrientacni?: number;
  };
  dic?: string;
  pravniForma?: string;
}

// Lookup company by IČO
aresRouter.get('/lookup/:ico', async (req: AuthRequest, res: Response) => {
  const { ico } = req.params;

  // Validate IČO format (8 digits)
  if (!/^\d{8}$/.test(ico)) {
    return res.status(400).json({ error: 'Invalid IČO format. Must be 8 digits.' });
  }

  try {
    // Call ARES API
    const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Company not found in ARES registry' });
      }
      throw new Error(`ARES API error: ${response.status}`);
    }

    const data = await response.json() as AresResponse;

    // Format address
    let address = '';
    if (data.sidlo) {
      const parts = [];
      if (data.sidlo.nazevUlice) {
        let street = data.sidlo.nazevUlice;
        if (data.sidlo.cisloDomovni) {
          street += ` ${data.sidlo.cisloDomovni}`;
          if (data.sidlo.cisloOrientacni) {
            street += `/${data.sidlo.cisloOrientacni}`;
          }
        }
        parts.push(street);
      }
      if (data.sidlo.psc && data.sidlo.nazevObce) {
        parts.push(`${data.sidlo.psc} ${data.sidlo.nazevObce}`);
      } else if (data.sidlo.nazevObce) {
        parts.push(data.sidlo.nazevObce);
      }
      address = parts.join(', ');
    }

    res.json({
      ico: data.ico,
      companyName: data.obchodniJmeno,
      address: address || data.sidlo?.textovaAdresa || '',
      dic: data.dic || null
    });
  } catch (error: any) {
    console.error('ARES lookup error:', error);

    // Provide fallback suggestion
    res.status(500).json({
      error: 'Failed to fetch company data from ARES',
      message: error.message,
      suggestion: 'Please enter company details manually'
    });
  }
});

// Validate IČO checksum
aresRouter.get('/validate/:ico', async (req: AuthRequest, res: Response) => {
  const { ico } = req.params;

  // Validate format
  if (!/^\d{8}$/.test(ico)) {
    return res.json({ valid: false, error: 'IČO must be 8 digits' });
  }

  // Validate checksum (modulo 11)
  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 7; i++) {
    sum += parseInt(ico[i]) * weights[i];
  }

  const remainder = sum % 11;
  let expectedLastDigit: number;

  if (remainder === 0) {
    expectedLastDigit = 1;
  } else if (remainder === 1) {
    expectedLastDigit = 0;
  } else {
    expectedLastDigit = 11 - remainder;
  }

  const isValid = parseInt(ico[7]) === expectedLastDigit;

  res.json({
    valid: isValid,
    error: isValid ? null : 'Invalid IČO checksum'
  });
});
