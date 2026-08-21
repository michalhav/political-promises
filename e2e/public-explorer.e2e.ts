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

  test("detail slibu doloží, o co se závěr opírá", async ({ page }) => {
    await page.goto("/promises/demo-a-2000-mestskych-najemnich-bytu");

    await expect(page.getByRole("heading", { level: 2, name: "Co bylo slíbeno" })).toBeVisible();
    await expect(page.getByText(/Stav podle veřejně dostupných zdrojů k/)).toBeVisible();

    // Odpověď na „proč to tak je" musí být na stránce, ne na vyžádání.
    await expect(
      page.getByRole("heading", { name: /Nakolik jde slib vůbec hodnotit/ }),
    ).toBeVisible();
    await expect(page.getByText(/Vážené skóre/).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Co se se slibem dělo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Čím je to doložené" })).toBeVisible();

    // Metrika: slíbený cíl i naměřená hodnota.
    await expect(page.getByText("Slíbený cíl")).toBeVisible();
    await expect(page.getByText("Naměřené hodnoty")).toBeVisible();
  });

  test("nehodnotitelný slib se netváří jako splněný", async ({ page }) => {
    await page.goto("/promises/demo-a-snizeni-dph-na-stavebni-prace");

    // Stupeň je i ve štítku v hlavičce, proto se ptáme na sekci se stavy.
    const status = page.getByRole("region", { name: "V jakém je slib stavu" });
    await expect(status.getByText("Nehodnotitelné")).toBeVisible();
    await expect(page.getByText(/pravomoci daného orgánu/)).toBeVisible();
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
