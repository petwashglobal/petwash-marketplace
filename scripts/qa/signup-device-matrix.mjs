import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:5179/signup';
const outDir = process.env.PETWASH_SIGNUP_QA_OUT || '/private/tmp/petwash-signup-device-matrix';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const consent = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  location: false,
  camera: false,
  washReminders: false,
  vaccinationReminders: false,
  promotionalNotifications: false,
  timestamp: new Date().toISOString(),
};

const deviceMatrix = [
  {
    name: 'iphone-se',
    label: 'iPhone SE / small Safari',
    dpr: 2,
    viewport: { width: 375, height: 667 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iphone-standard',
    label: 'iPhone standard Safari/Chrome iOS',
    dpr: 3,
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/136.0.0.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iphone-pro-max',
    label: 'iPhone Pro Max Safari',
    dpr: 3,
    viewport: { width: 430, height: 932 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'galaxy-s24',
    label: 'Samsung Galaxy S24 Chrome',
    dpr: 3,
    viewport: { width: 412, height: 915 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'galaxy-fold-narrow',
    label: 'Samsung Galaxy Fold narrow',
    dpr: 3,
    viewport: { width: 344, height: 882 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; SM-F946B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'xiaomi-14',
    label: 'Xiaomi / China flagship Chrome',
    dpr: 3,
    viewport: { width: 393, height: 873 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Xiaomi 24129PN74G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'huawei-honor',
    label: 'Huawei/Honor narrow browser',
    dpr: 3,
    viewport: { width: 360, height: 780 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; ALN-LX1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'ipad-portrait',
    label: 'iPad portrait Safari',
    dpr: 2,
    viewport: { width: 768, height: 1024 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  },
];

function rotated(viewport) {
  return { width: viewport.height, height: viewport.width };
}

async function launchBrowsers() {
  const browsers = [];

  try {
    browsers.push({
      name: 'chrome',
      instance: await chromium.launch({
        headless: true,
        executablePath: existsSync(chromePath) ? chromePath : undefined,
        args: ['--no-sandbox'],
      }),
    });
  } catch (error) {
    browsers.push({
      name: 'chrome',
      unavailable: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    browsers.push({
      name: 'webkit-safari-engine',
      instance: await webkit.launch({ headless: true }),
    });
  } catch (error) {
    browsers.push({
      name: 'webkit-safari-engine',
      unavailable: error instanceof Error ? error.message : String(error),
    });
  }

  return browsers;
}

async function inspect(page) {
  return page.evaluate(() => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const phoneWrapper = document.querySelector('.sl-field .intl-phone-wrapper');
    const overflowing = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute('class') || '').slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -2 || item.right > window.innerWidth + 2))
      .slice(0, 8);

    const safeTerms = document.querySelector('.sl-terms--quick');
    const panel = rectFor('.sl-panel');
    const logo = rectFor('.sl-logo');
    const heroCta = rectFor('.sl-heroCta');
    const isLandscape = window.innerWidth > window.innerHeight;
    const isTabletWidth = window.innerWidth >= 768;
    const logoTopLimit = isLandscape ? 45 : isTabletWidth ? 24 : 18;
    const logoWidthFloor = isLandscape
      ? Math.min(window.innerWidth * 0.25, 260)
      : isTabletWidth
        ? 360
        : Math.min(window.innerWidth * 0.72, 360);

    const checks = {
      blackCanvas: getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)',
      logoVisibleNearTop: Boolean(logo && logo.top <= logoTopLimit && logo.width >= logoWidthFloor),
      logoDominatesHeadline: Boolean(
        logo &&
          document.querySelector('.sl-h1') &&
          logo.height >= document.querySelector('.sl-h1').getBoundingClientRect().height,
      ),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2,
      noElementOverflow: overflowing.length === 0,
      phoneFieldNotWhite: !phoneWrapper || getComputedStyle(phoneWrapper).backgroundColor !== 'rgb(255, 255, 255)',
      oldSendCodeRemoved: !document.querySelector('.sl-entryBtn'),
      quickTermsVisible: Boolean(safeTerms && getComputedStyle(safeTerms).display !== 'none'),
      accountPanelReachable: Boolean(panel && panel.top < window.innerHeight * 0.78),
      primaryCtaReachable: Boolean(heroCta && heroCta.top < window.innerHeight * 0.72),
    };

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      logo,
      headline: rectFor('.sl-h1'),
      dog: rectFor('.sl-dog'),
      heroCta,
      panel,
      phoneWrapperBg: phoneWrapper ? getComputedStyle(phoneWrapper).backgroundColor : null,
      overflowing,
      checks,
      ok: Object.values(checks).every(Boolean),
    };
  });
}

async function runCase(browserName, browser, device, mode) {
  const viewport = mode === 'landscape' ? rotated(device.viewport) : device.viewport;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: device.dpr,
    isMobile: device.name !== 'ipad-portrait',
    hasTouch: true,
    userAgent: device.userAgent,
    colorScheme: 'dark',
  });

  const page = await context.newPage();
  await page.addInitScript((value) => {
    localStorage.setItem('petwash_consent_preferences', JSON.stringify(value));
    localStorage.setItem('petwash_cookie_consent', 'rejected');
    localStorage.setItem('pw_lang', 'en');
  }, consent);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.sl-shell', { timeout: 12000 });
  await page.waitForTimeout(250);

  const fileName = `${browserName}-${device.name}-${mode}.png`;
  const screenshotPath = join(outDir, fileName);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const metrics = await inspect(page);
  await context.close();

  return {
    browser: browserName,
    device: device.name,
    label: device.label,
    mode,
    screenshotPath,
    ...metrics,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browserSpecs = await launchBrowsers();
  const results = [];

  for (const spec of browserSpecs) {
    if (spec.unavailable) {
      results.push({ browser: spec.name, unavailable: spec.unavailable });
      continue;
    }

    for (const device of deviceMatrix) {
      for (const mode of ['portrait', 'landscape', 'portrait-again']) {
        try {
          results.push(await runCase(spec.name, spec.instance, device, mode));
        } catch (error) {
          results.push({
            browser: spec.name,
            device: device.name,
            label: device.label,
            mode,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    await spec.instance.close();
  }

  const failing = results.filter((result) => result.error || result.unavailable || result.ok === false);
  const summary = {
    url,
    outDir,
    generatedAt: new Date().toISOString(),
    total: results.length,
    failing: failing.length,
    results,
  };

  await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failing.some((result) => result.error || result.ok === false)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
