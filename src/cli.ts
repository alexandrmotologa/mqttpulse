#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { createMqttPulseServer } from './server/index.js';
import { createAppState } from './server/state.js';

const program = new Command();

program
  .name('mqttpulse')
  .description('Real-time MQTT 5.0 and 3.1.1 topic tree visualizer, payload decoder, and IoT fleet simulator')
  .version('1.0.0')
  .option('-b, --broker <url>', 'MQTT broker URL to connect to')
  .option('-p, --port <number>', 'Web Studio HTTP port', '4100')
  .option('-t, --topic <pattern>', 'Topic filter to subscribe to on startup', '#')
  .option('-e, --embedded-broker', 'Launch embedded in-memory MQTT broker on port 18883')
  .option('-s, --simulate', 'Automatically start IoT fleet simulator')
  .option('-n, --fleet-size <number>', 'Number of virtual IoT nodes to simulate', '50')
  .option('--profile <type>', 'Device profile: fleet_vehicle, hvac_industrial, smart_meter, weather_station, robotics_actuator, mixed', 'mixed')
  .option('--format <format>', 'Telemetry format: json, cbor, msgpack, protobuf', 'json')
  .option('--jitter <ms>', 'Injected network jitter (ms)', '0')
  .option('--drop <pct>', 'Injected packet drop percentage (0-100)', '0')
  .action(async (options) => {
    const port = parseInt(options.port, 10) || 4100;
    const state = createAppState();

    console.log(pc.cyan(`
   ███╗   ███╗ ██████╗ ████████╗████████╗██████╗ ██╗   ██╗██╗     ███████╗███████╗
   ████╗ ████║██╔═══██╗╚══██╔══╝╚══██╔══╝██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
   ██╔████╔██║██║   ██║   ██║      ██║   ██████╔╝██║   ██║██║     ███████╗█████╗  
   ██║╚██╔╝██║██║▄▄ ██║   ██║      ██║   ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  
   ██║ ╚═╝ ██║╚██████╔╝   ██║      ██║   ██║     ╚██████╔╝███████╗███████║███████╗
   ╚═╝     ╚═╝ ╚══▀▀═╝    ╚═╝      ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝
    `));
    console.log(pc.bold(pc.white(`   MQTT 5.0 & 3.1.1 Observability Studio + IoT Device Simulator`)));
    console.log(pc.gray(`   -----------------------------------------------------------------`));

    // 1. Embedded Broker
    let targetBrokerUrl = options.broker;
    if (options.embeddedBroker) {
      try {
        const brokerUrl = await state.embeddedBroker.start();
        console.log(pc.green(`   [BROKER] `) + pc.white(`Embedded Aedes MQTT broker running at `) + pc.yellow(brokerUrl));
        if (!targetBrokerUrl) {
          targetBrokerUrl = brokerUrl;
        }
      } catch (err: any) {
        console.error(pc.red(`   [BROKER ERROR] Failed to start embedded broker: ${err.message}`));
      }
    }

    // 2. Start HTTP & WebSocket Server
    const server = await createMqttPulseServer({ port }, state);
    const serverUrl = await server.start();
    console.log(pc.green(`   [STUDIO] `) + pc.white(`Web Studio & API listening at `) + pc.cyan(pc.bold(serverUrl)));
    console.log(pc.gray(`   [STUDIO] WebSocket telemetry stream ready at ${serverUrl}/ws`));

    // 3. Connect to MQTT Broker if URL provided
    if (targetBrokerUrl) {
      console.log(pc.blue(`   [CLIENT] `) + pc.white(`Connecting to broker `) + pc.yellow(targetBrokerUrl) + `...`);
      try {
        await state.mqttClient.connect({
          url: targetBrokerUrl,
          protocolVersion: '5.0',
          clean: true
        });
        console.log(pc.green(`   [CLIENT] `) + pc.white(`Connected to broker successfully!`));

        const subTopic = options.topic || '#';
        await state.mqttClient.subscribe(subTopic, 0);
        console.log(pc.green(`   [CLIENT] `) + pc.white(`Subscribed to topic filter: `) + pc.magenta(subTopic));
      } catch (err: any) {
        console.error(pc.yellow(`   [CLIENT WARN] Could not connect immediately: ${err.message}`));
        console.log(pc.gray(`   (You can connect or change broker settings from the Web Studio UI)`));
      }
    } else {
      console.log(pc.gray(`   [CLIENT] No broker specified. Connect in Web Studio or launch with --embedded-broker`));
    }

    // 4. Simulator auto-start if requested
    if (options.simulate) {
      const fleetSize = parseInt(options.fleetSize, 10) || 50;
      const jitter = parseInt(options.jitter, 10) || 0;
      const drop = parseFloat(options.drop) || 0;

      state.simulator.updateConfig({
        fleetSize,
        profile: options.profile || 'mixed',
        format: options.format || 'json',
        chaos: {
          jitterMinMs: jitter > 0 ? Math.floor(jitter / 2) : 0,
          jitterMaxMs: jitter,
          dropRatePct: drop,
          disconnectRatePct: 0,
          corruptRatePct: 0
        }
      });

      state.simulator.start();
      console.log(pc.green(`   [FLEET]  `) + pc.white(`IoT Fleet Simulator active: `) + pc.yellow(`${fleetSize} nodes`) + pc.gray(` (${options.profile}, ${options.format})`));
    }

    console.log(pc.gray(`   -----------------------------------------------------------------`));
    console.log(pc.dim(`   Press Ctrl+C to shut down.`));

    // Graceful exit
    const shutdown = async () => {
      console.log(pc.yellow(`\n   Shutting down MQTTPulse...`));
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parse(process.argv);
