import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Celý redakční průchod přes HTTP.
 *
 * Servisní vrstva je otestovaná zvlášť; tenhle test ověřuje to, co unit ani
 * integrační testy nevidí — že formuláře, server actions, session a přesměrování
 * do sebe zapadají. Je to zároveň definition of done fáze 3: redakce projde
 * cestu od zdroje po veřejně viditelný slib bez sahání do databáze.
 */
const PASSWORD = "demo-redakce";
const EDITOR = "redaktor1@example.org";
const REVIEWER = "redaktor2@example.org";

// Databáze je pro každý běh čerstvá, ale kdyby někdo server recykloval,
// náhodná přípona zabrání kolizi slugů.
const suffix = Math.random().toString(36).slice(2, 8);
const SLUG = `e2e-bezplatna-mhd-${suffix}`;
const TITLE = `E2E bezplatná MHD ${suffix}`;
const PROMISE_TEXT = `Zavedeme bezplatnou MHD pro seniory do konce roku 2025 (${suffix}).`;
const EVIDENCE_TEXT = `Rada schválila zavedení bezplatné MHD pro seniory (${suffix}).`;

async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(PASSWORD);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * V nabídce zdrojů je celý název včetně typu dokumentu, takže přesný label
 * dopředu neznáme. Vybereme podle hodnoty té položky, jejíž text název obsahuje.
 */
async function selectSourceByTitle(select: Locator, title: string) {
  const option = select.locator("option", { hasText: title }).first();
  await select.selectOption(await option.getAttribute("value"));
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Odhlásit" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
}

test.describe("redakční průchod", () => {
  test("od zdroje k publikovanému slibu", async ({ page }) => {
    await test.step("nepřihlášený se do adminu nedostane", async () => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/login$/);

      await page.goto("/admin/promises");
      await expect(page).toHaveURL(/\/admin\/login$/);
    });

    await test.step("editor se přihlásí", async () => {
      await login(page, EDITOR);
      await expect(page.getByRole("heading", { name: "Přehled" })).toBeVisible();
    });

    await test.step("založí zdrojový dokument", async () => {
      await page.goto("/admin/sources");
      await page.getByLabel("Typ dokumentu").selectOption({ label: "Volební program" });
      await page.getByLabel("Vydavatel").fill("Demo strana A");
      await page.getByLabel("Název dokumentu").fill(`E2E program ${suffix}`);
      await page.getByLabel("Nakládání s textem").selectOption({ label: "Ukládáme plný text" });
      await page
        .getByLabel("Text dokumentu")
        .fill(["PROGRAM", PROMISE_TEXT, EVIDENCE_TEXT].join("\n"));
      await page.getByLabel("Smyšlený dokument z ukázkového datasetu").check();
      await page.getByRole("button", { name: "Uložit zdroj" }).click();

      await expect(page).toHaveURL(/\/admin\/sources\/[0-9a-f-]{36}$/);
      // Provenience musí být na detailu vidět, včetně otisku obsahu.
      await expect(page.getByText("Otisk obsahu (SHA-256)")).toBeVisible();
    });

    await test.step("založí kandidáta na slib", async () => {
      await page.goto("/admin/promises/new");
      await page.getByLabel("Kandidátka").selectOption({ label: "Demo strana A" });
      await page.getByLabel("Krátký název").fill(TITLE);
      await page.getByLabel("Adresa (slug)").fill(SLUG);
      await page.getByLabel("Téma").selectOption({ label: "Doprava" });
      await selectSourceByTitle(page.getByLabel("Zdrojový dokument"), `E2E program ${suffix}`);
      await page.getByLabel("Citace ze zdroje").fill(PROMISE_TEXT);
      await page.getByLabel("Doslovné znění slibu").fill(PROMISE_TEXT);
      await page.getByRole("button", { name: "Založit kandidáta" }).click();

      await expect(page).toHaveURL(new RegExp(`/admin/promises/${SLUG}$`));
      await expect(page.getByText("Nepublikováno")).toBeVisible();
    });

    await test.step("nepublikovaný slib není veřejně vidět", async () => {
      const response = await page.request.get(`/promises/${SLUG}`);
      expect(response.status()).toBe(404);
    });

    await test.step("připojí důkaz", async () => {
      // Formulář je schovaný v <details>; nejdřív ho rozbalíme.
      await page.locator("summary", { hasText: "Připojit důkaz" }).click();
      const form = page.locator("details", { hasText: "Připojit důkaz" });
      await selectSourceByTitle(form.getByLabel("Zdrojový dokument"), `E2E program ${suffix}`);
      await form.getByLabel("Citace ze zdroje").fill(EVIDENCE_TEXT);
      await form.getByLabel("Vztah ke slibu").selectOption({ label: "Dokládá realizaci" });
      await form.getByRole("button", { name: "Připojit důkaz" }).click();

      await expect(page.getByText(EVIDENCE_TEXT)).toBeVisible();
    });

    await test.step("napíše hodnocení a předá ho k revizi", async () => {
      // Na stránce je i formulář pro úpravu kandidáta, který má vlastní pole
      // „Termín…". Cílíme proto do formuláře hodnocení, ne na celou stránku.
      const form = page.locator("form", {
        has: page.getByRole("button", { name: "Založit jako rozpracované" }),
      });

      await form.getByLabel("Konkrétnost").fill("5");
      await form.getByLabel("Měřitelnost").fill("5");
      await form.getByLabel("Termín").fill("4");
      await form.getByLabel("Pravomoc").fill("5");
      await form.getByLabel("Definice výsledku").fill("4");
      await form.getByLabel("Stav plnění").selectOption({ label: "Probíhá" });
      await form.getByLabel("Stav výsledku").selectOption({ label: "Zatím neměřitelné" });
      await form.getByLabel("Rozhodné datum rešerše").fill("2026-08-20");
      await form.getByLabel("Shrnutí").fill("Rada zavedení schválila, realizace běží.");
      await form.getByRole("button", { name: "Založit jako rozpracované" }).click();

      // Stav je v hlavičce i v tabulce verzí; ptáme se na tabulku, protože ta
      // je zdrojem pravdy o tom, co se uložilo.
      await expect(page.getByRole("cell", { name: "Rozpracováno" })).toBeVisible();

      await page.getByRole("button", { name: "Předat k revizi" }).click();
      await expect(page.getByRole("cell", { name: "Čeká na revizi" })).toBeVisible();
    });

    await test.step("autor nemůže schválit vlastní práci", async () => {
      await expect(page.getByRole("button", { name: "Schválit" })).toHaveCount(0);
      await expect(page.getByText("Vlastní hodnocení schválit nemůžeš")).toBeVisible();
    });

    await test.step("recenzent schválí a publikuje", async () => {
      await logout(page);
      await login(page, REVIEWER);
      await page.goto(`/admin/promises/${SLUG}`);

      await page.getByRole("button", { name: "Schválit" }).click();
      await expect(page.getByText("Podmínky publikace jsou splněné.")).toBeVisible();

      // Publikace se potvrzuje dialogem — je to nevratný krok.
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Publikovat" }).click();

      await expect(page.getByText("Veřejné od")).toBeVisible();
    });

    await test.step("slib je veřejně vidět i s důkazem a rozhodným datem", async () => {
      await page.goto(`/promises/${SLUG}`);

      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
      // Znění slibu je na stránce dvakrát: jako závazek a jako citace ze zdroje.
      await expect(page.getByText(PROMISE_TEXT).first()).toBeVisible();
      await expect(page.getByText(EVIDENCE_TEXT).first()).toBeVisible();
      await expect(page.getByText(/Stav podle veřejně dostupných zdrojů k/)).toBeVisible();
    });
  });

  test("nepodařené přihlášení neprozradí, jestli účet existuje", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill("nikdo@example.org");
    await page.getByLabel("Heslo").fill("spatne");
    await page.getByRole("button", { name: "Přihlásit se" }).click();

    // role="alert" má i route announcer Nextu, proto cílíme na text formuláře.
    await expect(page.getByText("Přihlášení se nezdařilo")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
