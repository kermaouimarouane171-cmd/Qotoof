import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/marouane/Downloads/ chafi3-marouane-kermaoui/greenmarket/play-console-screenshots';
const BASE_URL = 'http://127.0.0.1:4173';
const SUPABASE_URL = 'https://oyaiiyekfkflesdmcvvo.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWlpeWVrZmtmbGVzZG1jdnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTg4NDMsImV4cCI6MjA5MTY5NDg0M30.6GWGva5OXcOH55CwjvvHNXlPN4pF5EYqQPRLh5Y-USo';
const AUTH_STORAGE_KEY = 'sb-oyaiiyekfkflesdmcvvo-auth-token';
const PASSWORD = process.env.PLAY_CONSOLE_PASSWORD;
const ORDER_ID = 'fac00f2c-52cf-4043-b7b6-f210acdeed9f';
const DELIVERY_ID = '796970ea-76cd-4c8a-861b-f47a932599db';

if (!PASSWORD) {
  throw new Error('PLAY_CONSOLE_PASSWORD is required to generate Play Console screenshots.');
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

test.setTimeout(180000);

async function fetchSession(email) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to authenticate ${email}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function createMobileContext(browser, session) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    screen: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-MA',
    colorScheme: 'light',
  });

  await context.addInitScript(
    ({ authStorageKey, authSession }) => {
      if (authSession) {
        localStorage.setItem(authStorageKey, JSON.stringify(authSession));
      }
      localStorage.setItem('i18nextLng', 'ar');
    },
    { authStorageKey: AUTH_STORAGE_KEY, authSession: session || null }
  );

  return context;
}

async function sanitizeForScreenshot(page) {
  await page.addStyleTag({
    content: `
      aside,
      [role="complementary"] { display: none !important; }
      .flex.min-h-screen { display: block !important; }
      .flex.min-h-screen > div { width: 100% !important; max-width: 100% !important; }
      header, [role="banner"] { width: 100% !important; }
      main { width: 100% !important; max-width: 100% !important; padding: 16px !important; }
      body { overflow-x: hidden !important; }
    `,
  });

  await page.evaluate(() => {
    for (const element of document.querySelectorAll('body *')) {
      const text = element.textContent?.trim();
      if (!text) continue;
      if (/marouane\s+kermaoui/i.test(text) || /marouane/i.test(text) || /@greenmarket\.test/i.test(text)) {
        element.style.visibility = 'hidden';
      }
    }
  });
}

async function capture(page, url, waitForText, fileName) {
  await page.goto(url, { waitUntil: 'networkidle' });

  if (waitForText) {
    await page.waitForSelector(`text=${waitForText}`, { timeout: 20000 });
  }

  await sanitizeForScreenshot(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: false });
  expect(page.url()).toContain(url.replace(BASE_URL, ''));
}

test('generate play console screenshots', async ({ browser }) => {
  const buyerSession = await fetchSession('buyer@greenmarket.test');
  const driverSession = await fetchSession('driver@greenmarket.test');

  {
    const context = await createMobileContext(browser, null);
    const page = await context.newPage();
    await capture(page, `${BASE_URL}/`, 'طازج من', '03-home-hero.png');
    await context.close();
  }

  {
    const context = await createMobileContext(browser, buyerSession);
    const page = await context.newPage();
    await capture(page, `${BASE_URL}/orders/${ORDER_ID}/tracking`, 'تم التأكيد', '01-buyer-order-tracking.png');
    await context.close();
  }

  {
    const context = await createMobileContext(browser, driverSession);
    const page = await context.newPage();
    await capture(page, `${BASE_URL}/driver/delivery/${DELIVERY_ID}/complete`, 'إثبات التوصيل', '02-driver-delivery-proof.png');
    await context.close();
  }

  {
    const context = await createMobileContext(browser, driverSession);
    const page = await context.newPage();
    await capture(page, `${BASE_URL}/driver/delivery/${DELIVERY_ID}/tracking`, 'خريطة التوصيل الحية', '04-driver-live-tracking.png');
    await context.close();
  }
});