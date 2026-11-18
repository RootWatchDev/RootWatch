import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\kniker\\Desktop\\rootwatch\\screenshots';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2000));

  // --- 1. Switch to Quick Add Tab ---
  console.log('Opening Quick Add tab ...');
  const tabs = await page.$$('.tab-btn');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text && text.includes('Quick Add')) {
      await tab.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  // Capture Screenshot 3: Quick Add Presets
  console.log('Capturing 03_quick_add_presets.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '03_quick_add_presets.png') });

  // Add Big Buck Bunny first (Item index 2), then Lofi Girl (index 0), then Synthwave (index 1)
  const queueBtns = await page.$$('.quick-add-btn');
  if (queueBtns.length >= 3) {
    console.log('Queueing Big Buck Bunny, Lofi Girl, Synthwave ...');
    await queueBtns[2].click(); // Big Buck Bunny (direct MP4)
    await new Promise((r) => setTimeout(r, 600));
    await queueBtns[0].click(); // Lofi Girl
    await new Promise((r) => setTimeout(r, 400));
    await queueBtns[1].click(); // Synthwave
    await new Promise((r) => setTimeout(r, 600));
  }

  // --- 2. Switch back to Queue tab ---
  console.log('Switching to Queue tab ...');
  const tabsAfter = await page.$$('.tab-btn');
  for (const tab of tabsAfter) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text && text.includes('Queue')) {
      await tab.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  // Capture Screenshot 2: Active Playlist Queue
  console.log('Capturing 02_playlist_queue_active.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '02_playlist_queue_active.png') });

  // --- 3. Start Video Playback & Seek to an exciting frame ---
  console.log('Starting video playback ...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.muted = true;
      video.currentTime = 28;
      video.play().catch(() => {});
    }
    // Also trigger play button if needed
    const bigPlay = document.querySelector('.big-play-btn');
    if (bigPlay) bigPlay.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Hover over player canvas to show controls bar and timeline
  await page.hover('.player-canvas');
  await new Promise((r) => setTimeout(r, 600));

  // Capture Screenshot 1: Full Cinema Playback Experience
  console.log('Capturing 01_cinema_full_experience.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '01_cinema_full_experience.png') });

  // --- 4. Floating Animated Reactions ---
  console.log('Triggering floating reactions ...');
  const reactionBtns = await page.$$('.reaction-trigger-btn');
  if (reactionBtns.length >= 5) {
    await reactionBtns[1].click(); // 🔥
    await new Promise((r) => setTimeout(r, 150));
    await reactionBtns[4].click(); // 🍿
    await new Promise((r) => setTimeout(r, 150));
    await reactionBtns[0].click(); // ❤️
    await new Promise((r) => setTimeout(r, 200));
  }
  await page.hover('.player-canvas');
  await new Promise((r) => setTimeout(r, 400));

  // Capture Screenshot 4: Floating Reactions
  console.log('Capturing 04_floating_reactions_active.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '04_floating_reactions_active.png') });

  // --- 5. Toggle DJ Mode (Host Only) ---
  console.log('Toggling Host DJ Mode ...');
  const djToggle = await page.$('.dj-mode-toggle');
  if (djToggle) {
    await djToggle.click();
    await new Promise((r) => setTimeout(r, 500));
  }
  await page.hover('.player-canvas');
  await new Promise((r) => setTimeout(r, 400));

  // Capture Screenshot 5: Host DJ Mode
  console.log('Capturing 05_dj_mode_host_control.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '05_dj_mode_host_control.png') });

  // --- 6. Spectators & Real-Time Presence ---
  console.log('Adding spectator indicators ...');
  await page.evaluate(() => {
    const list = document.querySelector('.spectators-list');
    if (list) {
      list.innerHTML = `
        <div class="spectator-pill in-sync" title="Host - In Sync">
          <div class="spectator-avatar">👑</div>
          <span class="spectator-name">Host (You)</span>
          <span class="status-indicator">🟢</span>
        </div>
        <div class="spectator-pill in-sync" title="Alex - Drift: +4ms">
          <div class="spectator-avatar">AL</div>
          <span class="spectator-name">Alex</span>
          <span class="status-indicator">🟢</span>
        </div>
        <div class="spectator-pill in-sync" title="Elena - Drift: -6ms">
          <div class="spectator-avatar">EL</div>
          <span class="spectator-name">Elena</span>
          <span class="status-indicator">🟢</span>
        </div>
        <div class="spectator-pill buffering" title="Marcus - Buffering">
          <div class="spectator-avatar">MA</div>
          <span class="spectator-name">Marcus</span>
          <span class="status-indicator icon-spin">🔄</span>
        </div>
      `;
      const metric = document.querySelector('.metric-text');
      if (metric) metric.textContent = '3/4 In Sync';
    }
  });
  await page.hover('.player-canvas');
  await new Promise((r) => setTimeout(r, 400));

  // Capture Screenshot 6: Spectator Sync & Room Presence
  console.log('Capturing 06_spectators_presence_sync.png ...');
  await page.screenshot({ path: path.join(OUT_DIR, '06_spectators_presence_sync.png') });

  await browser.close();
  console.log('SUCCESS! All 6 updated high-resolution screenshots generated in:', OUT_DIR);
}

run().catch((err) => {
  console.error('Fatal screenshot error:', err);
  process.exit(1);
});
