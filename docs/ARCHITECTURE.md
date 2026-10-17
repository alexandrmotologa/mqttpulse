# MQTTPulse Architecture & Internals

This document covers the internal design of MQTTPulse, including the in-memory topic trie, protocol decoding pipeline, device simulation mathematics, and WebSocket streaming.

## 1. Topic Hierarchy Trie (`src/core/trie.ts`)

MQTT topic namespaces follow a hierarchical structure delimited by forward slashes (`/`), for example:
`factory/zoneA/line1/sensor/temperature`

### Data Structure
A standard hash table lookup on concrete topics fails to provide subtree aggregation or wildcard evaluation. MQTTPulse models the namespace as an in-memory Trie:

- **TopicNode**:
  - `segment`: The string identifier at this level.
  - `fullTopic`: The path from root down to this node.
  - `isLeaf`: Indicates whether messages have been published directly to this topic.
  - `messageCount`: Direct messages published to this exact topic.
  - `byteCount`: Cumulative payload bytes on this exact topic.
  - `children`: A `Map<string, TopicNode>` of downstream subtopics.
  - `rateCalc`: A `SlidingRateCalculator` that tracks rolling 10-second message frequencies.

### Subtree Aggregation
When querying any node (for instance `factory/zoneA`), MQTTPulse calculates recursive subtree aggregates:
- `aggregateMessageCount`: Sum of all direct messages across the node and all descendants.
- `aggregateByteCount`: Total payload bytes transmitted through the subtree.
- `aggregateMessagesPerSec`: Sum of rolling message rates across all leaf nodes.

### Performance
The Trie processes > 1,400,000 insertions per second on standard hardware with minimal garbage collection overhead, making it suitable for high-throughput brokers and dense IoT simulation.

---

## 2. Topic Matching & Wildcards (`src/core/wildcard.ts`)

MQTT defines two wildcard characters for subscription filters:
1. `+` (Single-Level Wildcard): Matches exactly one topic level.
2. `#` (Multi-Level Wildcard): Matches zero or more topic levels, and must appear as the final character in the filter.

### System Topics (`$SYS/`)
As specified in OASIS MQTT v3.1.1 and v5.0, filters beginning with `#` or `+` do not match topics that begin with a dollar sign `$`. MQTTPulse enforces this boundary during filter validation and Trie traversal.

---

## 3. In-Flight Payload Decoders (`src/decoders/`)

Telemetry streams often combine multiple encodings. The detection pipeline sniffs each payload through sequential heuristics:

```
+--------------------+
|  Incoming Payload  |
+---------+----------+
          |
          v
+--------------------+  Success
|  Try JSON Parser   +---------->  JSON Object + Formatted Tree
+---------+----------+
          | Failed
          v
+--------------------+  Contains binary bytes
| Binary Inspection  +--------------------------------+
+---------+----------+                                |
          |                                           v
          |                             +----------------------------+
          |                             | Try Dynamic Protobuf Types |
          |                             +-------------+--------------+
          |                                           | Failed
          |                                           v
          |                             +----------------------------+
          |                             | Try CBOR Deserializer      |
          |                             +-------------+--------------+
          |                                           | Failed
          |                                           v
          |                             +----------------------------+
          |                             | Try MessagePack Decoder    |
          |                             +-------------+--------------+
          |                                           | Failed
          v                                           v
+--------------------+                  +----------------------------+
|  Fallback to UTF-8 |                  | Generate Hex / ASCII Dump  |
+--------------------+                  +----------------------------+
```

1. **JSON**: Validates JSON formatting and produces clean indentation.
2. **CBOR**: Uses `cbor-x` to unpack Concise Binary Object Representation.
3. **MessagePack**: Uses `@msgpack/msgpack` to decode binary structures.
4. **Protocol Buffers**: Evaluates buffer against schemas registered in `protobufManager`. Includes default schemas for vehicles, weather stations, and smart energy meters, and accepts runtime user definitions.
5. **Hexadecimal View**: Aligns raw bytes into 16-byte rows with hex pairs and ASCII character representations.

---

## 4. Virtual IoT Device Simulator (`src/simulator/`)

### Physics Modeling
To avoid flat or artificial synthetic data, MQTTPulse uses an Ornstein-Uhlenbeck continuous mean-reverting stochastic process:

$$dx_t = \theta (\mu - x_t) dt + \sigma dW_t$$

Where:
- $\mu$ represents the equilibrium operating point (such as 22 °C or 230 V).
- $\theta$ is the mean-reversion rate pulling the metric back to nominal.
- $\sigma$ is the diffusion volatility with Gaussian noise generated via Box-Muller transformation.

### Diurnal Variations
Sensors exposed to solar cycles (ambient temperature, solar power, traffic congestion) incorporate a 24-hour sinusoidal curve so morning, peak afternoon, and nighttime telemetry fluctuate naturally.

### Fault Injection (Chaos Engine)
Testing backend ingest and alert systems requires simulating imperfect network conditions:
- **Jitter**: Introduces bounded delays (0 to 2,000 ms) before message dispatch.
- **Packet Drop**: Drops messages probabilistically prior to socket write.
- **Disconnects**: Triggers socket resets to test client reconnection and session recovery.
- **Bit Inversion**: Flips random bits in the payload buffer to test schema validation and corruption detection.

---

## 5. Streaming & WebSocket Protocol (`src/server/ws.ts`)

The web UI and backend communicate over WebSocket (`/ws`):
- `init`: Dispatched upon initial client handshake with complete current state.
- `message`: Emitted whenever a message is received and decoded.
- `tree_update`: Dispatched periodically with the updated Trie hierarchy for D3.js.
- `fleet_stats`: Emitted by the simulator with active node counts and emission rates.
- `status`: Dispatched when broker connectivity changes (connected, reconnecting, disconnected).
