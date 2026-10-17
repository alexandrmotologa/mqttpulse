/**
 * Hex Dump Formatter with Address Offsets, Hex Bytes, and ASCII view
 */

export interface HexDumpLine {
  offset: string;
  hex: string;
  ascii: string;
}

export interface HexDumpView {
  lines: HexDumpLine[];
  rawHex: string;
  byteLength: number;
}

export function formatHexDump(buffer: Buffer | Uint8Array, bytesPerLine = 16): HexDumpView {
  const buf = Buffer.from(buffer);
  const lines: HexDumpLine[] = [];
  const rawHex = buf.toString('hex');

  for (let i = 0; i < buf.length; i += bytesPerLine) {
    const chunk = buf.subarray(i, Math.min(i + bytesPerLine, buf.length));
    const offset = i.toString(16).padStart(8, '0');

    const hexParts: string[] = [];
    let asciiPart = '';

    for (let j = 0; j < chunk.length; j++) {
      const byte = chunk[j];
      hexParts.push(byte.toString(16).padStart(2, '0'));
      // ASCII printable range: 32 (space) to 126 (~)
      if (byte >= 32 && byte <= 126) {
        asciiPart += String.fromCharCode(byte);
      } else {
        asciiPart += '.';
      }
    }

    // Pad hex line if chunk is smaller than bytesPerLine
    const hex = hexParts.join(' ').padEnd(bytesPerLine * 3 - 1, ' ');

    lines.push({
      offset,
      hex,
      ascii: asciiPart
    });
  }

  return {
    lines,
    rawHex,
    byteLength: buf.length
  };
}
