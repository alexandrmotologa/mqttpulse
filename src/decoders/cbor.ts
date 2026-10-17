import { decode } from 'cbor-x';

export interface CborDecodeResult {
  success: boolean;
  data: unknown;
  formattedJson?: string;
  error?: string;
}

export function tryDecodeCbor(buffer: Buffer | Uint8Array): CborDecodeResult {
  try {
    const raw = Buffer.from(buffer);
    if (raw.length === 0) {
      return { success: false, data: null, error: 'Empty buffer' };
    }

    const data = decode(raw);
    if (data === undefined) {
      return { success: false, data: null, error: 'Undecodable CBOR data' };
    }

    // Convert potential BigInt or maps for JSON formatting
    const formatted = JSON.stringify(
      data,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    );

    return {
      success: true,
      data,
      formattedJson: formatted
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
