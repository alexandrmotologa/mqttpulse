import puppeteer from 'puppeteer';
import { createMqttPulseServer } from '../dist/server/index.js';
import { createAppState } from '../dist/server/state.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const docsImagesDir = path.resolve('docs/images');
const framesDir = path.resolve('temp_frames');

if (!fs.existsSync(docsImagesDir)) {
  fs.mkdirSync(docsImagesDir, { recursive: true });
}
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

async function run() {
  console.log('[ASSETS] Initializing MQTTPulse backend with embedded broker and simulator...');
  const state = createAppState();
  const brokerUrl = await state.embeddedBroker.start();

  const server = await createMqttPulseServer({ port: 4100 }, state);
  const serverUrl = await server.start();
  console.log(`[ASSETS] Server listening at ${serverUrl}`);

  await state.mqttClient.connect({
    url: brokerUrl,
    protocolVersion: '5.0',
    clean: true
  });
  await state.mqttClient.subscribe('#', 0);

  // Start simulator with 40 devices
  state.simulator.updateConfig({
    fleetSize: 40,
    profile: 'mixed',
    format: 'json',
    intervalMs: 800
  });
  state.simulator.start();

  console.log('[ASSETS] Simulator emitting live telemetry...');
  // Let the simulator populate messages, trie nodes, and geo markers
  await new Promise((r) => setTimeout(r, 3000));

  console.log('[ASSETS] Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(serverUrl, { waitUntil: 'networkidle0' });

  // Wait 1.5 seconds for D3 tree to render and telemetry stream to populate
  await new Promise((r) => setTimeout(r, 1500));

  let frameCount = 0;
  const captureFrames = async (numFrames = 6, intervalMs = 250) => {
    for (let i = 0; i < numFrames; i++) {
      const framePath = path.join(framesDir, `frame_${String(frameCount++).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath });
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  // Helper to click tab by title/label
  const clickTab = async (tabName) => {
    await page.evaluate((name) => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.toLowerCase().includes(name.toLowerCase()));
      if (btn) btn.click();
    }, tabName);
    await new Promise((r) => setTimeout(r, 800));
  };

  // 1. Screenshot 1: Radial Tree view
  console.log('[ASSETS] Capturing screenshot 1: Radial Tree view...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-1.png') });
  await captureFrames(8, 200);

  // 2. Switch to Plotter tab
  console.log('[ASSETS] Switching to Telemetry Plotter tab...');
  await clickTab('Plotter');
  await new Promise((r) => setTimeout(r, 1200));
  console.log('[ASSETS] Capturing screenshot 2: Live Telemetry Plotter...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-2.png') });
  await captureFrames(8, 200);

  // 3. Switch to Map tab
  console.log('[ASSETS] Switching to Fleet Geolocation Map tab...');
  await clickTab('Map');
  await new Promise((r) => setTimeout(r, 1000));
  console.log('[ASSETS] Capturing screenshot 3: Fleet Geolocation Map...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-3.png') });
  await captureFrames(8, 200);

  // 4. Click a message row in the table to open Packet Inspector drawer with Diff
  console.log('[ASSETS] Switching back to Radial and opening Packet Inspector...');
  await clickTab('Radial');
  const rows = await page.$$('.cursor-pointer');
  if (rows.length > 5) {
    await rows[rows.length - 2].click();
    await new Promise((r) => setTimeout(r, 800));

    // Click Payload Diff tab inside inspector
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.includes('Diff'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('[ASSETS] Capturing screenshot 4: Packet Inspector Payload Diff...');
    await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-4.png') });
    await captureFrames(6, 250);

    // Close inspector
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[title*="Close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5. Switch to RPC tab
  console.log('[ASSETS] Switching to RPC tab...');
  await clickTab('RPC');
  await new Promise((r) => setTimeout(r, 800));
  console.log('[ASSETS] Capturing screenshot 5: MQTT 5.0 RPC Console...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-5.png') });
  await captureFrames(6, 250);

  await browser.close();
  await server.stop();

  console.log(`[ASSETS] Compiling animated demo GIF from ${frameCount} frames with ffmpeg...`);
  const gifPath = path.join(docsImagesDir, 'mqttpulse_demo.gif');
  try {
    const palettePath = path.join(framesDir, 'palette.png');
    execSync(`ffmpeg -y -i "${framesDir}/frame_%04d.png" -vf "fps=5,scale=960:-1:flags=lanczos,palettegen" "${palettePath}"`, { stdio: 'inherit' });
    execSync(`ffmpeg -y -i "${framesDir}/frame_%04d.png" -i "${palettePath}" -lavfi "fps=5,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse" "${gifPath}"`, { stdio: 'inherit' });
    console.log(`[ASSETS] Successfully generated ${gifPath}`);
  } catch (err) {
    console.warn('[ASSETS WARN] Running fallback ffmpeg:', err.message);
    execSync(`ffmpeg -y -i "${framesDir}/frame_%04d.png" -vf "fps=5,scale=960:-1:flags=lanczos" "${gifPath}"`, { stdio: 'inherit' });
  }

  // Clean temp frames
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log('[ASSETS] Done! All visual assets generated.');
}

run().catch((err) => {
  console.error('[ASSETS ERROR]', err);
  process.exit(1);
});
