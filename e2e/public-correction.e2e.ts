import { expect, test, type Page } from "@playwright/test";

/**
 * Právo na odpověď přes HTTP.
 *
 * Ověřuje se to, co se stát musí (podnět dojde do redakce) i to, co se stát
 * nesmí (text se objeví na veřejné stránce dřív, než ho někdo přečte).
 */
const PUBLISHED_SLUG = "demo-a-2000-mestskych-najemnich-bytu";
const suffix = Math.random().toString(36).slice(2, 8);
const BODY = `Reakce kandidátky ${suffix}: hodnocení podle nás pomíjí usnesení rady z června.`;

async function loginAsEditor(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("redaktor1@example.org");
  await page.getByLabel("Heslo").fill("demo-redakce");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("podnět od veřejnosti", () => {
  test("projde formulářem, ale zveřejní se až po revizi", async ({ page }) => {
    await test.step("kdokoli odešle reakci bez přihlášení", async () => {
      await page.goto(`/promises/${PUBLISHED_SLUG}`);
      await page.getByText("Máte k tomuhle slibu co dodat?").click();

      await page.getByLabel("Píšete jako").selectOption("PARTY_RESPONSE");
      await page.getByLabel("Organizace").fill("Demo strana A");
      await page.getByLabel("Co je podle vás špatně").fill(BODY);
      await page.getByRole("button", { name: "Odeslat podnět" }).click();

      await expect(page.getByText("Děkujeme, podnět jsme přijali")).toBeVisible();
    });

    await test.step("na veřejné stránce se zatím neobjeví", async () => {
      await page.goto(`/promises/${PUBLISHED_SLUG}`);
      await expect(page.getByText(BODY)).toHaveCount(0);
    });

    await test.step("krátký text formulář odmítne", async () => {
      await page.goto(`/promises/${PUBLISHED_SLUG}`);
      await page.getByText("Máte k tomuhle slibu co dodat?").click();
      await page.getByLabel("Co je podle vás špatně").fill("chyba");
      await page.getByRole("button", { name: "Odeslat podnět" }).click();

      // Prohlížeč to zastaví na minLength; formulář se neodešle.
      await expect(page.getByText("Děkujeme, podnět jsme přijali")).toHaveCount(0);
    });

    await test.step("redakce ho vidí ve frontě", async () => {
      await loginAsEditor(page);
      await expect(page.getByText(/čeká na vyřízení/)).toBeVisible();
    });
  });
});
