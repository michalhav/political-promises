import { expect, test } from "@playwright/test";

/**
 * Veřejná cesta čtenáře.
 *
 * Pojistka proti regresi v tom, co vidí veřejnost: že filtry fungují jako
 * odkazy (a tedy i bez JavaScriptu), že se ke slibu dostane doložený zdroj
 * a že se nikde neobjeví nezkontrolovaný obsah.
 */
test.describe("veřejná část", () => {
  test("z úvodní stránky přes filtr do detailu slibu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Co politici slíbili");
    // Ukázková data musí být označená, ne schovaná v patičce.
    await expect(page.getByText("Ukázková data")).toBeVisible();

    await page.getByRole("link", { name: "Prozkoumat sliby" }).click();
    await expect(page).toHaveURL(/\/promises$/);

    await page.getByRole("link", { name: "Bydlení", exact: true }).click();
    await expect(page).toHaveURL(/topic=HOUSING/);
    await expect(page.getByRole("status")).toContainText("Nalezeno");

    await page.getByRole("link", { name: /2 000 nových městských/ }).click();
    await expect(page).toHaveURL(/\/promises\/demo-a-2000-mestskych-najemnich-bytu$/);
  });

  test("detail slibu nejdřív odpoví a teprve pak dokládá", async ({ page }) => {
    await page.goto("/promises/demo-a-2000-mestskych-najemnich-bytu");

    // Odpověď stojí nahoře, ne rozdrobená mezi metadaty.
    const stav = page.getByRole("region", { name: "Aktuální stav" });
    await expect(stav).toBeVisible();
    await expect(stav).toContainText("Průběh realizace");
    await expect(stav).toContainText("Výsledek");
    await expect(stav).toContainText("Podle veřejných zdrojů prošlých k");
    await expect(stav).toContainText("Co to znamená");

    // Původní znění musí být rozeznatelné jako politický originál.
    await expect(page.getByRole("heading", { level: 2, name: "Co bylo slíbeno" })).toBeVisible();
    await expect(page.locator("blockquote").first()).toContainText("2 000");

    // Teprve pak „proč to říkáme", příběh a plný archiv.
    await expect(page.getByRole("heading", { level: 2, name: "Jak to víme" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Co se od voleb dělo" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Důkazy a zdroje" })).toBeVisible();

    // Metodika je deep-dive, ne první, co čtenář potká.
    await expect(
      page.getByRole("heading", { level: 2, name: "Jak vzniklo hodnocení" }),
    ).toBeVisible();

    // Metrika: slíbený cíl i naměřená hodnota.
    await expect(page.getByText("Slíbený cíl")).toBeVisible();
    await expect(page.getByText("Naměřené hodnoty")).toBeVisible();
  });

  test("důkaz odděluje, co zdroj dokládá, od toho, co z něj neplyne", async ({ page }) => {
    await page.goto("/promises/demo-a-2000-mestskych-najemnich-bytu");

    const archiv = page.getByRole("region", { name: "Důkazy a zdroje" });
    await expect(archiv.getByText("Co tento zdroj dokládá").first()).toBeVisible();
    // Nejcennější věta celého bloku: kam už zdroj nesahá.
    await expect(archiv.getByText("Co z něj nelze vyvodit").first()).toBeVisible();
    await expect(archiv.getByText(/neříká nic o dosažení slíbených 2 000/)).toBeVisible();
  });

  test("stav bez doloženého postupu nelze číst jako konstatování nečinnosti", async ({ page }) => {
    await page.goto("/promises/demo-d-500-novych-kamer");

    const stav = page.getByRole("region", { name: "Aktuální stav" });
    await expect(stav).toContainText("Bez doloženého postupu");
    await expect(stav).toContainText("Co to neznamená");
    await expect(stav).toContainText("neznamená, že se nic neděje");
  });

  test("nehodnotitelný slib dá odpověď větou, ne třemi štítky", async ({ page }) => {
    await page.goto("/promises/demo-a-snizeni-dph-na-stavebni-prace");

    const verdikt = page.getByRole("region", {
      name: "Tento slib nelze objektivně vyhodnotit",
    });
    await expect(verdikt).toBeVisible();
    await expect(verdikt).toContainText(/pravomoci daného orgánu/);
  });

  test("porovnání s koaliční smlouvou ukazuje obě znění", async ({ page }) => {
    await page.goto("/compare");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Program vs. koaliční smlouva",
    );
    await expect(page.getByText("Volební program").first()).toBeVisible();
    await expect(page.getByText("Koaliční smlouva").first()).toBeVisible();
    await expect(page.getByText(/Proč tato klasifikace/).first()).toBeVisible();
  });

  test("metodika vypisuje algoritmus, ne jen obecné sliby o transparentnosti", async ({ page }) => {
    await page.goto("/methodology");

    await expect(page.getByRole("heading", { name: "Jak počítáme hodnotitelnost" })).toBeVisible();
    await expect(page.getByText(/váha 30 %/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Co nevíme, netvrdíme" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Co tahle metodika neumí/ })).toBeVisible();
  });

  test("neexistující slib vrací 404", async ({ page }) => {
    const response = await page.request.get("/promises/neexistujici-slib");
    expect(response.status()).toBe(404);
  });
});
