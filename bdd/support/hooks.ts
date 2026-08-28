import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

setDefaultTimeout(60000);

let browser: Browser;
let context: BrowserContext;
let page: Page;

BeforeAll(async function () {
  browser = await chromium.launch({ headless: true });
});

AfterAll(async function () {
  await browser?.close();
});

Before(async function () {
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'reports/videos/' }
  });
  page = await context.newPage();
  this.page = page;
  this.context = context;
});

After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    const screenshot = await page.screenshot();
    this.attach(screenshot, 'image/png');
  }
  await context?.close();
});

export { page, context };
