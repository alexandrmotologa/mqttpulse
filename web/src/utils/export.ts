import { InboundMessage } from '../types';

export function exportToCsv(messages: InboundMessage[], filename = 'mqttpulse_messages.csv'): void {
  const headers = ['id', 'timestamp', 'time_iso', 'topic', 'qos', 'retained', 'format', 'byte_size', 'payload'];
  const rows = messages.map((m) => {
    const timeIso = new Date(m.timestamp).toISOString();
    const cleanPayload = (m.decoded.rawString || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return [
      m.id,
      m.timestamp,
      timeIso,
      `"${m.topic}"`,
      m.qos,
      m.retain ? 'true' : 'false',
      m.decoded.format,
      m.decoded.byteLength,
      `"${cleanPayload}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function exportToJsonl(messages: InboundMessage[], filename = 'mqttpulse_messages.jsonl'): void {
  const lines = messages.map((m) => JSON.stringify(m));
  const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
