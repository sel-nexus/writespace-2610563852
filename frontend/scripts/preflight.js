/** Capture representative UI text evidence and screenshots for human review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PREFLIGHT_URL || 'http://127.0.0.1:4173';
await mkdir('preflight-output', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
for (const [name, width, path] of [['desktop', 1280, '/'], ['mobile-login', 390, '/login'], ['mobile-menu', 390, '/']]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}${path}`);
  if (name === 'mobile-menu') await page.getByRole('button', { name: /menu/i }).click();
  results.push({ name, tree: await page.accessibility.snapshot(), styles: await page.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    width: document.documentElement.scrollWidth,
    headings: [...document.querySelectorAll('h1,h2')].map((el) => ({ text: el.textContent, font: getComputedStyle(el).fontFamily })),
  })), html: await page.content() });
  await page.screenshot({ path: `preflight-output/${name}.png`, fullPage: true });
}
await writeFile('preflight-output/review.json', JSON.stringify(results, null, 2));
await browser.close();
