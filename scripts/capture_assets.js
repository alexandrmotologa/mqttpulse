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

  // Start simulator with 35 devices
  state.simulator.updateConfig({
    fleetSize: 35,
    profile: 'mixed',
    format: 'json',
    intervalMs: 800
  });
  state.simulator.start();

  console.log('[ASSETS] Simulator emitting live telemetry...');
  // Let the simulator populate some messages and trie nodes
  await new Promise((r) => setTimeout(r, 2500));

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

  console.log('[ASSETS] Capturing screenshot 1: Radial Tree view...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-1.png') });

  // Record a sequence of frames for GIF
  console.log('[ASSETS] Recording frames for animated GIF...');
  for (let i = 0; i < 15; i++) {
    const framePath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Click on the first message row to open Packet Inspector drawer
  console.log('[ASSETS] Opening Packet Inspector...');
  const rows = await page.$$('.cursor-pointer');
  if (rows.length > 5) {
    // Click a table row
    await rows[rows.length - 2].click();
    await new Promise((r) => setTimeout(r, 800));

    // Click Hex / ASCII Dump tab inside inspector
    const hexTab = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.includes('Hex / ASCII'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    await new Promise((r) => setTimeout(r, 600));
    console.log('[ASSETS] Capturing screenshot 2: Packet Inspector Hex Dump...');
    await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-2.png') });

    for (let i = 15; i < 22; i++) {
      const framePath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: framePath });
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Switch to IoT Simulator tab
  console.log('[ASSETS] Switching to IoT Simulator tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes('IoT Simulator'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  console.log('[ASSETS] Capturing screenshot 3: IoT Fleet Simulator & Chaos panel...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-3.png') });

  for (let i = 22; i < 30; i++) {
    const framePath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Switch to Topic List indented view
  console.log('[ASSETS] Switching to Topic List tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes('Topic List'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  console.log('[ASSETS] Capturing screenshot 4: Topic List view...');
  await page.screenshot({ path: path.join(docsImagesDir, 'mqttpulse-4.png') });

  await browser.close();
  await server.stop();

  console.log('[ASSETS] Compiling animated demo GIF with ffmpeg...');
  const gifPath = path.join(docsImagesDir, 'mqttpulse_demo.gif');
  try {
    // Generate palette and high quality gif with palettegen and paletteuse
    const palettePath = path.join(framesDir, 'palette.png');
    execSync(`ffmpeg -y -i "${framesDir}/frame_%03d.png" -vf "fps=6,scale=960:-1:flags=lanczos,palettegen" "${palettePath}"`, { stdio: 'inherit' });
    execSync(`ffmpeg -y -i "${framesDir}/frame_%03d.png" -i "${palettePath}" -lavfi "fps=6,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse" "${gifPath}"`, { stdio: 'inherit' });
    console.log(`[ASSETS] Successfully generated ${gifPath}`);
  } catch (err) {
    console.warn('[ASSETS WARN] Could not run 2-pass palette, running simple fallback ffmpeg:', err.message);
    execSync(`ffmpeg -y -i "${framesDir}/frame_%03d.png" -vf "fps=5,scale=960:-1:flags=lanczos" "${gifPath}"`, { stdio: 'inherit' });
  }

  // Clean temp frames
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log('[ASSETS] Done! All visual assets generated.');
}

run().catch((err) => {
  console.error('[ASSETS ERROR]', err);
  process.exit(1);
});
