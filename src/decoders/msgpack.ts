import { decode } from '@msgpack/msgpack';

export interface MsgPackDecodeResult {
  success: boolean;
  data: unknown;
  formattedJson?: string;
  error?: string;
}

export function tryDecodeMsgPack(buffer: Buffer | Uint8Array): MsgPackDecodeResult {
  try {
    const raw = Buffer.from(buffer);
    if (raw.length === 0) {
      return { success: false, data: null, error: 'Empty buffer' };
    }

    const data = decode(raw);
    if (data === undefined) {
      return { success: false, data: null, error: 'Undecodable MessagePack data' };
    }

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
