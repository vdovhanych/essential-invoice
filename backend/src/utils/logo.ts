import sharp from 'sharp';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Check bytes before invoking a decoder: SVG/XML must never reach librsvg.
export async function normalizeLogo(data: Buffer, mime: string): Promise<Buffer> {
  const png = mime === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = ['image/jpeg', 'image/jpg'].includes(mime) && data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if ((!png && !jpeg) || data.length > MAX_LOGO_BYTES) throw new Error('Invalid logo');
  // Decode fully, bound decompression work, discard metadata and trailing content.
  const result = await sharp(data, { limitInputPixels: 16_000_000, failOn: 'warning' })
    .rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer();
  if (result.length > MAX_LOGO_BYTES) throw new Error('Logo is too large');
  return result;
}

export async function storedLogo(data: string | null, mime: string | null): Promise<Buffer | null> {
  if (!data || !mime || data.length > Math.ceil(MAX_LOGO_BYTES / 3) * 4) return null;
  try { return await normalizeLogo(Buffer.from(data, 'base64'), mime); }
  catch { return null; } // Old SVG or corrupt logos must not break invoice generation.
}
