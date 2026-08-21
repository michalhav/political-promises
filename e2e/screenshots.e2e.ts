import { expect, test, type Page } from "@playwright/test";

/**
 * Snímky obrazovek pro vizuální kontrolu.
 *
 * Neběží při běžném `npm run test:e2e` — je to nástroj, ne test. Spouští se
 * `CAPTURE_SCREENSHOTS=1 npx playwright test screenshots` a slouží k tomu, aby
 * šlo posoudit vzhled bez ručního proklikávání aplikace.
 *
 * Vědomě to nejsou snapshot testy. Porovnávat pixely by u stránky, která se
 * mění s obsahem, znamenalo hlavně údržbu falešných poplachů.
 */
test.skip(!process.env.CAPTURE_SCREENSHOTS, "Spouští se jen s CAPTURE_SCREENSHOTS=1.");

test.describe.configure({ mode: "serial" });

const DIR = "e2e/screenshots";
const PUBLISHED_SLUG = "demo-a-2000-mestskych-najemnich-bytu";

async function shoot(page: Page, name: string, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

test.describe("veřejná část", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("snímky veřejných stránek", async ({ page }) => {
    await shoot(page, "01-uvod", "/");
    await shoot(page, "02-sliby", "/promises");
    await shoot(page, "03-sliby-filtr", "/promises?topic=TRANSPORT");
    await shoot(page, "04-detail-slibu", `/promises/${PUBLISHED_SLUG}`);
    await shoot(page, "05-detail-nehodnotitelny", "/promises/demo-a-pece-o-mestskou-zelen");
    await shoot(page, "06-porovnani", "/compare");
    await shoot(page, "07-metodika", "/methodology");
  });

  test("snímky na mobilu", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await shoot(page, "20-mobil-uvod", "/");
    await shoot(page, "21-mobil-sliby", "/promises");
    await shoot(page, "22-mobil-detail", `/promises/${PUBLISHED_SLUG}`);

    await context.close();
  });

  test("snímky v tmavém režimu", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    await shoot(page, "30-tma-uvod", "/");
    await shoot(page, "31-tma-detail", `/promises/${PUBLISHED_SLUG}`);

    await context.close();
  });
});

test.describe("redakce", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("snímky redakční konzole", async ({ page }) => {
    await shoot(page, "10-prihlaseni", "/admin/login");

    await page.getByLabel("E-mail").fill("redaktor1@example.org");
    await page.getByLabel("Heslo").fill("demo-redakce");
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await shoot(page, "11-prehled", "/admin");
    await shoot(page, "12-zdroje", "/admin/sources");
    await shoot(page, "13-novy-kandidat", "/admin/promises/new");
    await shoot(page, "14-sliby", "/admin/promises");
    await shoot(page, "16-kandidatky", "/admin/lists");

    // Detail zdroje nese fronty návrhů od stroje; jde na něj přes seznam,
    // protože identifikátor dokumentu dopředu neznáme.
    await page.goto("/admin/sources");
    await page.locator("table a").first().click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${DIR}/17-zdroj-navrhy.png`, fullPage: true });
    await shoot(page, "15-detail-slibu", `/admin/promises/${PUBLISHED_SLUG}`);
  });
});
