import { expect, test, type Page } from "@playwright/test";

/**
 * Vytěžování kandidátů přes konzoli.
 *
 * E2E běh jede s `AI_PROVIDER=fixture`, takže návrhy vyrábí deterministická
 * heuristika a nic to nestojí. Ověřuje se cesta, ne kvalita modelu: běh se dá
 * spustit, návrh se dá přijmout, a z přijatého návrhu vznikne **nepublikovaný**
 * kandidát — ne slib na webu.
 */
const suffix = Math.random().toString(36).slice(2, 8);
const DOC_TITLE = `E2E program pro vytěžení ${suffix}`;
const PROMISE_SENTENCE = `Postavíme ${suffix} nových cyklostezek do konce roku 2027.`;
const SLUG = `e2e-navrh-${suffix}`;

async function login(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("redaktor1@example.org");
  await page.getByLabel("Heslo").fill("demo-redakce");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("návrhy od stroje", () => {
  test("redakce vytěží kandidáty a jeden přijme", async ({ page }) => {
    await login(page);

    await test.step("založí zdroj se závazkem v textu", async () => {
      await page.goto("/admin/sources");
      await page.getByLabel("Typ dokumentu").selectOption({ label: "Volební program" });
      await page.getByLabel("Vydavatel").fill("Demo strana A");
      await page.getByLabel("Název dokumentu").fill(DOC_TITLE);
      await page.getByLabel("Nakládání s textem").selectOption({ label: "Ukládáme plný text" });
      await page
        .getByLabel("Text dokumentu")
        .fill(["PROGRAM", PROMISE_SENTENCE, "Praha je krásné město."].join("\n\n"));
      await page.getByLabel("Smyšlený dokument z ukázkového datasetu").check();
      await page.getByRole("button", { name: "Uložit zdroj" }).click();

      await expect(page).toHaveURL(/\/admin\/sources\/[0-9a-f-]{36}$/);
    });

    await test.step("spustí vytěžování", async () => {
      await page.getByRole("button", { name: "Vytěžit kandidáty" }).click();
      await expect(page.getByText(/Návrhů k revizi: [1-9]/)).toBeVisible();
      await expect(page.getByText(PROMISE_SENTENCE).first()).toBeVisible();
    });

    await test.step("druhý běh nad týmž textem se odmítne", async () => {
      await page.getByRole("button", { name: "Vytěžit kandidáty" }).click();
      await expect(page.getByRole("alert").first()).toContainText("už touhle verzí promptu prošel");
    });

    await test.step("přijme návrh jako kandidáta", async () => {
      const form = page.locator("form", {
        has: page.getByRole("button", { name: "Přijmout jako kandidáta" }),
      });
      const first = form.first();

      await first.getByLabel("Kandidátka").selectOption({ index: 1 });
      await first.getByLabel("Adresa (slug)").fill(SLUG);
      await first.getByRole("button", { name: "Přijmout jako kandidáta" }).click();

      await expect(page).toHaveURL(new RegExp(`/admin/promises/${SLUG}$`));
      await expect(page.getByText("Nepublikováno")).toBeVisible();
    });

    await test.step("přijatý návrh není veřejně vidět", async () => {
      const response = await page.request.get(`/promises/${SLUG}`);
      expect(response.status()).toBe(404);
    });
  });
});
