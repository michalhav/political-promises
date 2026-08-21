import { expect, test, type Page } from "@playwright/test";

// Pozn.: `getByLabel` porovnává text celého <label>, a ten nese i hvězdičku
// povinného pole a nápovědu. Proto regulární výraz od začátku, ne přesná shoda.

/**
 * Onboarding skutečného subjektu přes konzoli.
 *
 * Doteď šlo stranu i kandidátku založit jedině seedem, takže nasazení nového
 * města nebo nových voleb znamenalo ruční SQL. Tenhle průchod ověřuje to, co
 * servisní testy nevidí: že se nová kandidátka hned nabídne ve formuláři
 * kandidáta na slib — bez toho by byla k ničemu.
 */
const suffix = Math.random().toString(36).slice(2, 8);
const PARTY_SLUG = `e2e-strana-${suffix}`;
const LIST_SLUG = `e2e-kandidatka-${suffix}`;
const PARTY_NAME = `E2E strana ${suffix}`;
const LIST_NAME = `E2E kandidátka ${suffix}`;

async function login(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("redaktor1@example.org");
  await page.getByLabel("Heslo").fill("demo-redakce");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("evidence stran a kandidátek", () => {
  test("redakce založí stranu a kandidátku, která je hned použitelná", async ({ page }) => {
    await login(page);

    await test.step("založí stranu", async () => {
      await page.goto("/admin/lists");

      const form = page.locator("form", {
        has: page.getByRole("button", { name: "Založit stranu" }),
      });
      await form.getByLabel(/^Název/).fill(PARTY_NAME);
      await form.getByLabel("Krátký název").fill(`E2E ${suffix}`);
      await form.getByLabel("Adresa (slug)").fill(PARTY_SLUG);
      await form.getByRole("button", { name: "Založit stranu" }).click();

      await expect(page.getByText("Strana založena.")).toBeVisible();
      await expect(page.getByText(PARTY_NAME).first()).toBeVisible();
    });

    await test.step("obsazenou adresu odmítne", async () => {
      const form = page.locator("form", {
        has: page.getByRole("button", { name: "Založit stranu" }),
      });
      await form.getByLabel(/^Název/).fill("Jiná strana");
      await form.getByLabel("Krátký název").fill("Jiná");
      await form.getByLabel("Adresa (slug)").fill(PARTY_SLUG);
      await form.getByRole("button", { name: "Založit stranu" }).click();

      // Next si drží vlastní role="alert" pro oznamování navigace, proto hlídáme
      // ten uvnitř formuláře.
      await expect(form.getByRole("alert")).toContainText(PARTY_SLUG);
    });

    await test.step("založí kandidátku za tu stranu", async () => {
      await page.goto("/admin/lists");

      const form = page.locator("form", {
        has: page.getByRole("button", { name: "Založit kandidátku" }),
      });
      await form.getByLabel(/^Název/).fill(LIST_NAME);
      await form.getByLabel("Krátký název").fill(`E2E-K ${suffix}`);
      await form.getByLabel("Adresa (slug)").fill(LIST_SLUG);
      await form.getByLabel("Číslo na hlasovacím lístku").fill("42");
      await form.getByLabel("Získané mandáty").fill("7");
      await form.getByLabel("Strany za kandidátkou").selectOption({ label: PARTY_NAME });
      await form.getByRole("button", { name: "Založit kandidátku" }).click();

      await expect(page.getByText("Kandidátka založena.")).toBeVisible();

      const row = page.locator("tr", { hasText: LIST_NAME });
      await expect(row).toContainText(`E2E ${suffix}`);
      // Nová kandidátka zatím žádný slib nenese.
      await expect(row.getByRole("cell").last()).toHaveText("0");
    });

    await test.step("kandidátka se hned nabízí u nového slibu", async () => {
      await page.goto("/admin/promises/new");
      const options = await page.getByLabel("Kandidátka").locator("option").allTextContents();
      expect(options).toContain(LIST_NAME);
    });
  });
});
