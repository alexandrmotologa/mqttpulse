# MQTTPulse: Master Implementation Plan

> **High-Speed MQTT 5.0 & 3.1.1 Broker Observability Studio, Topic Tree Visualizer & IoT Device Simulator**
>
> *Deep-dive telemetry workbench for IoT, smart home, robotics, and industrial automation engineers. Connects to any MQTT broker, visualizes real-time topic trees with wildcard subscriptions, decodes MQTT 5.0 user properties, inspects binary/JSON payloads, and simulates synthetic IoT device fleets under network chaos.*

---

## 1. Project Overview & Architecture

The Internet of Things (IoT), industrial telemetry, and connected device architectures rely on the MQTT protocol (ports 1883/8883). However, developers face severe tooling bottlenecks:
1. **Opaque Topic Hierarchies**: Inability to visualize the active topic tree across complex wildcard patterns (`sensors/+/temperature`, `fleet/#`), leading to orphaned messages and ghost topics.
2. **MQTT 5.0 Blindspots**: Legacy tools fail to expose modern MQTT 5.0 features such as User Properties, Reason Codes, Content-Type, Payload Format Indicators, and Message Expiry Intervals.
3. **Payload Inconvenience**: Telemetry arrives in binary formats (Protobuf, CBOR, MessagePack) or nested JSON without in-flight decoding or schema validation.
4. **Lack of Load & Chaos Simulation**: Testing backend subscribers requires spinning up real hardware or writing complex scripts to simulate hundreds of sensor disconnects, jitter, and packet loss.

**MQTTPulse** provides an all-in-one developer cockpit and load generation engine:
- **Universal Broker Connectivity**: Seamlessly connects to Mosquitto, EMQX, HiveMQ, AWS IoT Core, and Azure IoT Hub over TCP, TLS, and WebSocket.
- **Dynamic Topic Hierarchy Trie**: Discovers topic namespaces in real-time and renders a radial/collapsible topic tree with message rate heatmaps.
- **Deep Packet & Protocol Inspector**: Decodes MQTT 5.0 header metadata, QoS 0/1/2 acknowledgment timing, Retain flags, and Last Will and Testament (LWT) states.
- **In-Flight Payload Parser**: Automatically detects and decodes JSON, Protocol Buffers (using user `.proto` definitions), CBOR, MessagePack, and Hex dumps.
- **Virtual IoT Fleet Chaos Simulator**: Spins up 10 to 1,000 synthetic devices with realistic telemetry profiles (GPS drifts, battery discharges, temperature fluctuations) and network failure injection.

```
+-----------------------------------------------------------------------------------+
|                                     MQTTPULSE                                     |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------v-------------------------+                 +-----------------------v-------+
|     Broker Connection Engine    |                 |     Topic Tree Trie Engine    |
|  * MQTT 5.0 & 3.1.1 Over TCP/TLS|                 |  * Real-Time Namespace Trie   |
|  * WebSocket Transport          |                 |  * Wildcard Matcher (+, #)    |
|  * Auto-Reconnect & Keep-Alive  |                 |  * Msg/Sec Throughput Heatmap |
+-------+-------------------------+                 +-----------------------+-------+
        |                                                                   |
        +---------------------------------+---------------------------------+
                                          |
                        +-----------------v-----------------+
                        |    In-Flight Payload Decoder      |
                        |  * JSON, Protobuf, CBOR, MsgPack  |
                        |  * MQTT 5.0 User Properties       |
                        |  * QoS 0/1/2 Delivery Latency     |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   IoT Fleet & Chaos Simulator     |
                        |  * 1,000 Virtual Sensor Nodes     |
                        |  * Realistic Physical Telemetry   |
                        |  * Jitter & Disconnect Injection  |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Web Studio & Terminal TUI       |
                        |  * Radial Topic Tree Visualizer   |
                        |  * Live Message Stream & Replay   |
                        |  * Payload Diff & Export          |
                        +-----------------------------------+
```

---

## 2. Directory Structure

```
mqttpulse/
├── src/
│   ├── core/
│   │   ├── client.ts             # MQTT 5.0/3.1.1 connection manager
│   │   ├── trie.ts               # In-memory topic hierarchy Trie data structure
│   │   ├── wildcard.ts           # MQTT wildcard matcher (+, #)
│   │   └── stats.ts              # Throughput, rate estimation, and byte metrics
│   ├── decoders/
│   │   ├── json.ts               # Fast JSON parser with syntax highlighting
│   │   ├── protobuf.ts           # Dynamic Protobuf decoder using .proto files
│   │   ├── cbor.ts               # Concise Binary Object Representation parser
│   │   ├── msgpack.ts            # MessagePack decoder
│   │   └── hex.ts                # Raw byte hex/ASCII viewer
│   ├── simulator/
│   │   ├── fleet_manager.ts      # Multi-device lifecycle coordinator
│   │   ├── device_profile.ts     # Pre-built sensors: GPS, Weather, SmartMeter
│   │   ├── physics.ts            # Realistic continuous random walk math
│   │   └── chaos.ts              # Latency injection, packet drop, random disconnects
│   ├── server/
│   │   ├── api.ts                # Fastify REST endpoints for management
│   │   └── sse.ts                # Server-Sent Events / WebSocket stream to UI
│   └── cli.ts                    # Node.js CLI entry point
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopicTreeRadial.tsx   # D3.js interactive radial topic tree
│   │   │   ├── PacketInspector.tsx   # MQTT 5.0 header & payload inspector
│   │   │   ├── FleetControls.tsx     # Simulator setup: sliders for nodes, drops
│   │   │   └── MessageStreamTable.tsx# Virtualized real-time message table
│   │   ├── hooks/
│   │   │   └── useMqttStream.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── trie.test.ts
│   ├── wildcard.test.ts
│   └── simulator.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Implementation Roadmap

### Phase 1: High-Performance MQTT Client & Topic Trie
- Implement `src/core/client.ts` using `mqtt` (v5 support) with support for:
  - Clean Session / Clean Start flags, Session Expiry Interval.
  - Last Will and Testament (LWT) configuration.
  - Connect timeout, automatic backoff reconnect, and keep-alive ping management.
- Implement `src/core/trie.ts`:
  - Build a Trie where each node represents a topic level (e.g. `factory` -> `line1` -> `motor3` -> `temperature`).
  - Calculate rolling 10-second message rates (`msgs/sec`) and cumulative byte size per branch.
  - Implement `src/core/wildcard.ts` for efficient matching of single-level (`+`) and multi-level (`#`) subscriptions.

### Phase 2: In-Flight Payload Decoder & Protocol 5.0 Inspector
- Implement payload auto-detection in `src/decoders/`:
  - Sniff magic bytes or validate UTF-8 to determine format: JSON, MessagePack, CBOR, or raw binary.
  - Support user-provided `.proto` schema files for real-time Protocol Buffer deserialization.
- Capture and expose MQTT 5.0 specific metadata:
  - `UserProperties`: Key-value string pairs passed by publishers.
  - `ResponseTopic` and `CorrelationData` for request-response patterns.
  - `ContentType` and `PayloadFormatIndicator`.
  - Calculate QoS 1 (`PUBACK`) and QoS 2 (`PUBREC` -> `PUBREL` -> `PUBCOMP`) roundtrip latency.

### Phase 3: Virtual IoT Fleet & Chaos Engine
- Implement `src/simulator/fleet_manager.ts`:
  - Instantiate up to 1,000 independent virtual MQTT client connections.
  - Support pre-configured device templates:
    - **Fleet Vehicle**: Publishes GPS latitude/longitude, speed, and fuel level.
    - **HVAC Unit**: Publishes ambient temperature, setpoint, compressor status.
    - **Smart Energy Meter**: Publishes active power (kW), voltage, current, power factor.
- Implement physics and chaos modeling:
  - Realistic time-series generation with Gaussian noise and diurnal cycles.
  - `src/simulator/chaos.ts`: Injects simulated packet drops, network lag (50ms - 2000ms), and sudden TCP socket termination.

### Phase 4: Modern Web Studio & CLI Diagnostics
- Build the web interface in React 19 + Tailwind CSS:
  - **Radial / Collapsible Topic Tree**: Interactive D3.js visualization where node radius and color reflect message throughput.
  - **Packet Inspector Drawer**: Deep dive into MQTT headers, User Properties, and decoded payload tabs (Parsed Object, Raw JSON, Hex Dump).
  - **Live Filter Bar**: Instant client-side filtering by topic regex, QoS level, or payload substring.
- Single command runner: `npx mqttpulse --broker mqtt://broker.emqx.io:1883 --topic "sensors/#"`.

### Phase 5: Verification, Benchmarks & End-to-End Tests
- Unit tests for Trie insertion, deletion, and wildcard resolution.
- Performance benchmark: Process > 20,000 messages/sec through the Trie with < 5% CPU usage.
- Integration tests against embedded Mosquitto / Aedes broker.

---

## 4. Agent Kickoff Prompt

```markdown
You are implementing **MQTTPulse**, a high-speed MQTT 5.0 & 3.1.1 broker observability studio, topic tree visualizer, and IoT device simulator in Node.js 22 + TypeScript + React 19.

### Execution Plan:
1. Initialize the project in `B:\workgit\mqttpulse` with root `package.json` and TypeScript configuration.
2. Implement `src/core/trie.ts` and `wildcard.ts` for real-time topic namespace indexing with rolling message rate calculations and wildcard matching (`+`, `#`).
3. Implement `src/core/client.ts` supporting MQTT 5.0 and 3.1.1 over TCP, TLS, and WebSockets.
4. Implement payload decoders in `src/decoders/` for JSON, CBOR, MessagePack, Protobuf, and Hex dumps.
5. Implement `src/simulator/` to generate virtual IoT fleets (vehicles, weather stations, smart meters) with configurable chaos (jitter, drops, disconnects).
6. Build the web studio in `web/` with interactive D3 topic tree, packet inspector drawer, and virtualized message table.
7. Implement the CLI entrypoint in `src/cli.ts` supporting `--broker`, `--topic`, `--simulate`, and `--port`.

Maintain 100% production code without mocks, placeholders, or empty handlers.
```
