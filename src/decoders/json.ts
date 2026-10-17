/**
 * JSON Payload Decoder
 */

export interface JsonDecodeResult {
  success: boolean;
  data: unknown;
  formattedJson: string;
  error?: string;
}

export function tryDecodeJson(buffer: Buffer | Uint8Array): JsonDecodeResult {
  try {
    const text = Buffer.from(buffer).toString('utf8').trim();
    // Quick heuristic: must start with { or [ or be a primitive
    if (!text.startsWith('{') && !text.startsWith('[') && !text.startsWith('"') && isNaN(Number(text))) {
      return { success: false, data: null, formattedJson: text, error: 'Not JSON format' };
    }

    const data = JSON.parse(text);
    return {
      success: true,
      data,
      formattedJson: JSON.stringify(data, null, 2)
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      formattedJson: '',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
