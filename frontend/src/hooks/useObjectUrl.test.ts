import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useObjectUrl, toPreviewMimeType } from './useObjectUrl';

// base64 for "hello"
const VALID_B64 = 'aGVsbG8=';

describe('toPreviewMimeType', () => {
  it('returns a literal for each previewable type', () => {
    expect(toPreviewMimeType('image/jpeg')).toBe('image/jpeg');
    expect(toPreviewMimeType('image/png')).toBe('image/png');
    expect(toPreviewMimeType('application/pdf')).toBe('application/pdf');
  });

  it('rejects anything else, including types that merely look like images', () => {
    expect(toPreviewMimeType('image/svg+xml')).toBeNull();
    expect(toPreviewMimeType('text/html')).toBeNull();
    expect(toPreviewMimeType('image/')).toBeNull();
    expect(toPreviewMimeType(null)).toBeNull();
    expect(toPreviewMimeType(undefined)).toBeNull();
  });
});

describe('useObjectUrl', () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    // jsdom implements neither
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => {
        const url = `blob:test/${created.length}`;
        created.push(url);
        return url;
      }),
      revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when there is nothing to preview', () => {
    const { result } = renderHook(() => useObjectUrl(null, 'image/png'));
    expect(result.current).toBeNull();

    const { result: noType } = renderHook(() => useObjectUrl(VALID_B64, null));
    expect(noType.current).toBeNull();
  });

  it('mints a blob URL rather than embedding the payload', () => {
    const { result } = renderHook(() => useObjectUrl(VALID_B64, 'image/png'));
    expect(result.current).toBe('blob:test/0');
    // The base64 never appears in the URL handed to the element
    expect(result.current).not.toContain(VALID_B64);
  });

  it('revokes the URL on unmount so the blob is not leaked', () => {
    const { unmount } = renderHook(() => useObjectUrl(VALID_B64, 'image/png'));
    expect(revoked).toHaveLength(0);
    unmount();
    expect(revoked).toEqual(['blob:test/0']);
  });

  it('falls back to null on malformed base64 instead of throwing', () => {
    const { result } = renderHook(() => useObjectUrl('not valid base64!!', 'image/png'));
    expect(result.current).toBeNull();
  });
});
