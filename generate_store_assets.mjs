import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\kniker\\Desktop\\rootwatch\\assets';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  // ----------------------------------------------------
  // 1. Generate App Icon (512x512)
  // ----------------------------------------------------
  console.log('Generating 512x512 App Icon ...');
  const iconPage = await browser.newPage();
  await iconPage.setViewport({ width: 512, height: 512, deviceScaleFactor: 2 });

  const iconHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 512px;
    height: 512px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .icon-container {
    width: 480px;
    height: 480px;
    border-radius: 110px;
    background: radial-gradient(circle at 30% 20%, #2e1065 0%, #170936 50%, #090314 100%);
    border: 2px solid rgba(168, 85, 247, 0.4);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 50px rgba(147, 51, 234, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .ambient-glow {
    position: absolute;
    width: 320px;
    height: 320px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, rgba(6, 182, 212, 0.3) 50%, transparent 75%);
    filter: blur(40px);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .clapper-svg {
    width: 250px;
    height: 250px;
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 12px 24px rgba(0,0,0,0.6));
  }
  .brand-badge {
    position: absolute;
    bottom: 42px;
    z-index: 2;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #a855f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
</style>
</head>
<body>
  <div class="icon-container">
    <div class="ambient-glow"></div>
    <svg class="clapper-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#241442" />
          <stop offset="100%" stop-color="#120824" />
        </linearGradient>
        <linearGradient id="stripeCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="stripePurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#9333ea" />
        </linearGradient>
        <linearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#a855f7" />
          <stop offset="100%" stop-color="#ec4899" />
        </linearGradient>
      </defs>

      <!-- Main Slate Body -->
      <rect x="14" y="32" width="72" height="52" rx="10" fill="url(#bodyGrad)" stroke="rgba(168,85,247,0.5)" stroke-width="2.5" />

      <!-- Top Clapper Bar with Slanted Stripes -->
      <rect x="14" y="16" width="72" height="14" rx="4" fill="#1b1033" stroke="rgba(168,85,247,0.5)" stroke-width="2" />
      <path d="M22 16 L30 16 L22 30 L14 30 Z" fill="url(#stripeCyan)" />
      <path d="M38 16 L46 16 L38 30 L30 30 Z" fill="url(#stripePurple)" />
      <path d="M54 16 L62 16 L54 30 L46 30 Z" fill="url(#stripeCyan)" />
      <path d="M70 16 L78 16 L70 30 L62 30 Z" fill="url(#stripePurple)" />

      <!-- Vibrant Glowing Center Play Icon -->
      <polygon points="43,45 68,58 43,71" fill="url(#playGrad)" filter="drop-shadow(0 4px 10px rgba(168,85,247,0.8))" />
    </svg>
    <div class="brand-badge">ROOTWATCH</div>
  </div>
</body>
</html>
  `;

  await iconPage.setContent(iconHtml);
  await iconPage.screenshot({
    path: path.join(OUT_DIR, 'rootwatch_icon.png'),
    omitBackground: true
  });
  await iconPage.close();
  console.log('App Icon saved to: rootwatch_icon.png');

  // ----------------------------------------------------
  // 2. Generate App Banner (1600x600)
  // ----------------------------------------------------
  console.log('Generating 1600x600 App Banner ...');
  const bannerPage = await browser.newPage();
  await bannerPage.setViewport({ width: 1600, height: 600, deviceScaleFactor: 1.5 });

  const bannerHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1600px;
    height: 600px;
    display: flex;
    background: #090314;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    overflow: hidden;
    position: relative;
  }
  .banner-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 75% 30%, #3b0764 0%, #1e0838 40%, #090314 90%);
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(147, 51, 234, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(147, 51, 234, 0.08) 1px, transparent 1px);
    background-size: 50px 50px;
  }
  .banner-content {
    position: relative;
    z-index: 2;
    display: flex;
    width: 100%;
    height: 100%;
    padding: 70px 90px;
    align-items: center;
    justify-content: space-between;
  }
  .left-col {
    max-width: 780px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .app-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(147, 51, 234, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 20px;
    font-size: 14px;
    font-weight: 700;
    color: #c084fc;
    letter-spacing: 1px;
    text-transform: uppercase;
    width: fit-content;
  }
  .app-title {
    font-size: 64px;
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.1;
    background: linear-gradient(135deg, #ffffff 30%, #e2e8f0 60%, #c084fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .app-desc {
    font-size: 20px;
    line-height: 1.5;
    color: #94a3b8;
    max-width: 680px;
  }
  .feature-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
  }
  .pill {
    padding: 8px 16px;
    background: rgba(30, 20, 50, 0.7);
    border: 1px solid rgba(147, 51, 234, 0.3);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(8px);
  }
  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .right-col {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cinema-card {
    width: 480px;
    height: 310px;
    border-radius: 20px;
    background: linear-gradient(145deg, #1f1238 0%, #0d071a 100%);
    border: 1px solid rgba(168, 85, 247, 0.4);
    box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 50px rgba(147, 51, 234, 0.3);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .cinema-screen {
    width: 100%;
    height: 180px;
    border-radius: 12px;
    background: radial-gradient(circle at center, #3b0764 0%, #170936 80%);
    border: 1px solid rgba(147, 51, 234, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .cinema-play {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: linear-gradient(135deg, #a855f7, #ec4899);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 25px rgba(168, 85, 247, 0.8);
  }
  .cinema-play svg {
    margin-left: 4px;
  }
  .floating-emoji {
    position: absolute;
    font-size: 32px;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
  }
  .emoji-1 { top: 20px; right: 25px; }
  .emoji-2 { bottom: 35px; left: 30px; }
  .emoji-3 { top: 40px; left: 25px; }

  .cinema-bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
  }
  .cinema-progress {
    width: 70%;
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }
  .cinema-progress-fill {
    width: 55%;
    height: 100%;
    background: linear-gradient(90deg, #a855f7, #06b6d4);
  }
  .sync-badge {
    font-size: 12px;
    font-weight: 700;
    color: #10b981;
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
</head>
<body>
  <div class="banner-bg"></div>
  <div class="grid-pattern"></div>
  <div class="banner-content">
    <div class="left-col">
      <div class="app-tag">🎬 Native Root App</div>
      <h1 class="app-title">RootWatch</h1>
      <p class="app-desc">Synchronized cinema and watch parties built natively for Root. Stream YouTube and web media with zero-drift timeline synchronization, shared playlists, DJ host controls, and live floating reactions.</p>
      <div class="feature-pills">
        <div class="pill"><div class="pill-dot"></div> Sub-Second Adaptive Sync</div>
        <div class="pill">▶️ YouTube & Direct MP4</div>
        <div class="pill">👑 Host DJ Control Mode</div>
        <div class="pill">🍿 Live Floating Reactions</div>
      </div>
    </div>

    <div class="right-col">
      <div class="cinema-card">
        <div class="cinema-screen">
          <div class="cinema-play">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span class="floating-emoji emoji-1">🍿</span>
          <span class="floating-emoji emoji-2">🔥</span>
          <span class="floating-emoji emoji-3">❤️</span>
        </div>
        <div class="cinema-bottom-bar">
          <div class="cinema-progress">
            <div class="cinema-progress-fill"></div>
          </div>
          <div class="sync-badge">
            <span class="pill-dot"></span> In-Sync (±8ms)
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await bannerPage.setContent(bannerHtml);
  await bannerPage.screenshot({
    path: path.join(OUT_DIR, 'rootwatch_banner.png')
  });
  await bannerPage.close();
  console.log('App Banner saved to: rootwatch_banner.png');

  await browser.close();
  console.log('All store graphic assets created successfully!');
}

run().catch((err) => {
  console.error('Asset generation error:', err);
  process.exit(1);
});
