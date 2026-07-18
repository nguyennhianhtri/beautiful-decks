const fs = require('fs');
const os = require('os');
const path = require('path');

function browserCandidates() {
  const env = [process.env.BROWSER_PATH, process.env.PUPPETEER_EXECUTABLE_PATH].filter(Boolean);
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [
      ...env,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
  }
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean);
    return [
      ...env,
      ...roots.flatMap(root => [
        path.join(root, 'Google/Chrome/Application/chrome.exe'),
        path.join(root, 'Chromium/Application/chrome.exe'),
        path.join(root, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(root, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      ]),
    ];
  }
  return [
    ...env,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
  ];
}

function resolveBrowserPath() {
  const checked = [];
  for (const candidate of browserCandidates()) {
    if (!candidate || checked.includes(candidate)) continue;
    checked.push(candidate);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'No Chromium-family browser found. Install Chrome/Chromium/Edge/Brave or set ' +
    `BROWSER_PATH. Checked: ${checked.join(', ')}`
  );
}

function launchOptions(extra = {}) {
  return {
    executablePath: resolveBrowserPath(),
    headless: 'new',
    args: [
      '--no-sandbox',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--hide-scrollbars',
    ],
    ...extra,
  };
}

module.exports = { browserCandidates, resolveBrowserPath, launchOptions };
