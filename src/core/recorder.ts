import { EventEmitter } from 'events';

export interface RecordedMessage {
  deltaMs: number;
  topic: string;
  payloadHex: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  properties?: Record<string, unknown>;
}

export interface RecordedSession {
  sessionId: string;
  name: string;
  startTime: number;
  durationMs: number;
  messageCount: number;
  messages: RecordedMessage[];
}

export class TelemetryRecorder extends EventEmitter {
  private recording = false;
  private startTime = 0;
  private currentName = '';
  private buffer: RecordedMessage[] = [];
  private lastSession: RecordedSession | null = null;

  public get isRecording(): boolean {
    return this.recording;
  }

  public get currentBufferLength(): number {
    return this.buffer.length;
  }

  public get currentSession(): RecordedSession | null {
    return this.lastSession;
  }

  public start(name = 'IoT Telemetry Session'): void {
    this.recording = true;
    this.startTime = Date.now();
    this.currentName = name;
    this.buffer = [];
    this.emit('start', { name, startTime: this.startTime });
  }

  public record(topic: string, payload: Buffer, qos: 0 | 1 | 2, retain: boolean, properties?: any): void {
    if (!this.recording) return;

    const deltaMs = Date.now() - this.startTime;
    this.buffer.push({
      deltaMs,
      topic,
      payloadHex: payload.toString('hex'),
      qos,
      retain,
      properties
    });

    // Auto-limit memory to 10,000 recorded items per session
    if (this.buffer.length >= 10000) {
      this.stop();
    }
  }

  public recordMessage(msg: {
    topic: string;
    payloadHex?: string;
    payload?: Buffer;
    qos?: 0 | 1 | 2;
    retain?: boolean;
    properties?: any;
  }): void {
    const buf = msg.payload ?? Buffer.from(msg.payloadHex || '', 'hex');
    this.record(msg.topic, buf, msg.qos ?? 0, msg.retain ?? false, msg.properties);
  }

  public async replay(
    speedMultiplier = 1.0,
    onMessage: (msg: RecordedMessage) => Promise<void> | void
  ): Promise<void> {
    if (!this.lastSession) return;
    const replayer = new TelemetryReplayer();
    await replayer.replay(this.lastSession, speedMultiplier, onMessage);
  }

  public stop(): RecordedSession {
    if (!this.recording) {
      return this.lastSession || {
        sessionId: 'empty',
        name: 'Empty Session',
        startTime: 0,
        durationMs: 0,
        messageCount: 0,
        messages: []
      };
    }

    this.recording = false;
    const durationMs = Date.now() - this.startTime;
    const session: RecordedSession = {
      sessionId: `session_${this.startTime}_${Math.random().toString(16).substring(2, 6)}`,
      name: this.currentName,
      startTime: this.startTime,
      durationMs,
      messageCount: this.buffer.length,
      messages: this.buffer
    };

    this.lastSession = session;
    this.emit('stop', session);
    return session;
  }

  public exportJsonl(session = this.lastSession): string {
    if (!session || session.messages.length === 0) return '';
    const metaLine = JSON.stringify({
      __type: 'MQTTPulse_Session_Meta',
      sessionId: session.sessionId,
      name: session.name,
      startTime: session.startTime,
      durationMs: session.durationMs,
      messageCount: session.messageCount
    });

    const msgLines = session.messages.map((m) => JSON.stringify(m));
    return [metaLine, ...msgLines].join('\n');
  }

  public importJsonl(content: string): RecordedSession {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) throw new Error('File is empty');

    let meta: any = {};
    const messages: RecordedMessage[] = [];

    for (let i = 0; i < lines.length; i++) {
      const obj = JSON.parse(lines[i]);
      if (i === 0 && obj.__type === 'MQTTPulse_Session_Meta') {
        meta = obj;
      } else {
        messages.push(obj);
      }
    }

    const session: RecordedSession = {
      sessionId: meta.sessionId || `imported_${Date.now()}`,
      name: meta.name || 'Imported Session',
      startTime: meta.startTime || Date.now(),
      durationMs: meta.durationMs || (messages.length > 0 ? messages[messages.length - 1].deltaMs : 0),
      messageCount: messages.length,
      messages
    };

    this.lastSession = session;
    return session;
  }
}

export class TelemetryReplayer extends EventEmitter {
  private active = false;
  private paused = false;
  private abortController: AbortController | null = null;

  public get isReplaying(): boolean {
    return this.active;
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  public async replay(
    session: RecordedSession,
    speedMultiplier = 1.0,
    onMessage: (msg: RecordedMessage) => Promise<void> | void
  ): Promise<void> {
    if (this.active) {
      this.stop();
    }

    this.active = true;
    this.paused = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.emit('start', { sessionId: session.sessionId, speed: speedMultiplier });

    const safeSpeed = Math.max(speedMultiplier, 0.1);
    let lastDelta = 0;

    try {
      for (let i = 0; i < session.messages.length; i++) {
        if (signal.aborted) break;

        while (this.paused && !signal.aborted) {
          await new Promise((r) => setTimeout(r, 100));
        }

        const msg = session.messages[i];
        const sleepDuration = Math.max(0, (msg.deltaMs - lastDelta) / safeSpeed);
        lastDelta = msg.deltaMs;

        if (sleepDuration > 0) {
          await new Promise((r) => setTimeout(r, Math.min(sleepDuration, 10000)));
        }

        if (signal.aborted) break;

        await onMessage(msg);
        this.emit('progress', { index: i + 1, total: session.messages.length });
      }
    } finally {
      this.active = false;
      this.paused = false;
      this.emit('done');
    }
  }

  public pause(): void {
    this.paused = true;
    this.emit('pause');
  }

  public resume(): void {
    this.paused = false;
    this.emit('resume');
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.active = false;
    this.paused = false;
    this.emit('stop');
  }
}
