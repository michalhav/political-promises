import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Přístupnostní laťka.
 *
 * Brief má přístupnost jako povinnost, ne jako přání: sémantické HTML,
 * ovladatelnost klávesnicí, dostatečný kontrast, a hlavně **stav se nikdy
 * nesmí kódovat jen barvou**. Bez automatické kontroly je z toho zbožné přání,
 * které se při prvním redesignu tiše ztratí.
 *
 * Testy vznikly **před** redesignem schválně. Až se změní vzhled, tahle sada
 * řekne, jestli se přístupnost zlepšila, nebo jen pohledově.
 *
 * Automatická kontrola odhalí zhruba třetinu problémů — zbytek (smysluplné
 * pořadí, srozumitelnost popisků, ovládání klávesnicí ve složitých prvcích)
 * pozná jen člověk. Zelený běh proto **neznamená přístupnou aplikaci**,
 * znamená jen, že se nezhoršila v tom, co stroj měří.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Chyby téhle závažnosti považujeme za rozbité, ne za kosmetiku. */
const BLOCKING = new Set(["serious", "critical"]);

const PASSWORD = "demo-redakce";
const PUBLISHED_SLUG = "demo-a-2000-mestskych-najemnich-bytu";

async function analyse(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.filter((violation) => BLOCKING.has(violation.impact ?? "minor"));
}

/** Čitelný výpis, ať se nálezy nemusí lovit z JSON dumpu. */
function describe(violations: Awaited<ReturnType<typeof analyse>>): string {
  return violations
    .map((violation) => {
      const where = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("\n      ");
      return `  [${violation.impact}] ${violation.id}: ${violation.help}\n      ${where}`;
    })
    .join("\n");
}

async function expectAccessible(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const violations = await analyse(page);
  expect(violations, `Přístupnost ${path}:\n${describe(violations)}`).toEqual([]);
}

async function loginAsEditor(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("redaktor1@example.org");
  await page.getByLabel("Heslo").fill(PASSWORD);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("přístupnost veřejné části", () => {
  test("úvodní stránka", async ({ page }) => {
    await expectAccessible(page, "/");
  });

  test("přehled slibů včetně filtrů", async ({ page }) => {
    await expectAccessible(page, "/promises");
  });

  test("přehled s aktivním filtrem", async ({ page }) => {
    await expectAccessible(page, "/promises?topic=TRANSPORT");
  });

  test("detail slibu", async ({ page }) => {
    await expectAccessible(page, `/promises/${PUBLISHED_SLUG}`);
  });

  test("nehodnotitelný slib", async ({ page }) => {
    await expectAccessible(page, "/promises/demo-a-pece-o-mestskou-zelen");
  });

  test("porovnání s koaliční smlouvou", async ({ page }) => {
    await expectAccessible(page, "/compare");
  });

  test("metodika", async ({ page }) => {
    await expectAccessible(page, "/methodology");
  });
});

test.describe("přístupnost v tmavém režimu", () => {
  test.use({ colorScheme: "dark" });

  test("detail slibu má dost kontrastu i ve tmě", async ({ page }) => {
    // Kontrast se u tmavého režimu rozbíjí nejčastěji, protože se ladí ten světlý.
    await expectAccessible(page, `/promises/${PUBLISHED_SLUG}`);
  });

  test("přehled a zapnutý filtr ve tmě", async ({ page }) => {
    // Barevné plochy stavů a zapnutého filtru vznikly při redesignu, takže
    // právě ony jsou nejčerstvější kandidát na propadlý kontrast.
    await expectAccessible(page, "/promises");
    await expectAccessible(page, "/promises?topic=HOUSING");
  });
});

/**
 * Přizpůsobení obsahu (WCAG 1.4.10) a rozestupy textu (1.4.12).
 *
 * Obojí axe nezměří — jsou to vlastnosti rozvržení, ne DOM. Přitom právě
 * tady se redesign rozbíjí nejčastěji: stačí jedna neodřádkovatelná lišta
 * nebo pevná výška a stránka začne ujíždět do strany.
 */
const PUBLIC_PATHS = [
  "/",
  "/promises",
  "/promises?topic=HOUSING",
  `/promises/${PUBLISHED_SLUG}`,
  "/compare",
  "/methodology",
];

/** Vodorovné ujíždění celé stránky. Vlastní posuvné kontejnery se nepočítají. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}

test.describe("kotvy na téže stránce", () => {
  test("po skoku na sekci pokračuje tabulátor v ní, ne zpátky v liště", async ({ page }) => {
    await page.goto(`/promises/${PUBLISHED_SLUG}`);

    const listaSekci = page.getByRole("navigation", { name: "Části stránky" });
    await listaSekci.getByRole("link", { name: "Důkazy" }).click();
    await page.keyboard.press("Tab");

    const kdeJsme = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.closest("section")?.getAttribute("aria-labelledby") ?? null;
    });

    // Kdyby kotvu odbavoval router místo prohlížeče, skončil by fokus na další
    // položce lišty a čtenář by se ke skočené sekci klávesnicí nedostal.
    expect(kdeJsme).toBe("dukazy");
  });
});

test.describe("přizpůsobení obsahu", () => {
  // 320 px je spodní hranice, kterou WCAG 1.4.10 předpokládá.
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of PUBLIC_PATHS) {
    test(`na 320 px neujíždí do strany: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const overflow = await horizontalOverflow(page);
      expect(overflow, `${path} přetéká o ${overflow} px`).toBeLessThanOrEqual(1);
    });
  }

  test("zvětšené rozestupy textu nic neuříznou", async ({ page }) => {
    await page.goto(`/promises/${PUBLISHED_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Hodnoty předepisuje přímo WCAG 1.4.12.
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; }
        p, li, h1, h2, h3 { margin-bottom: 2em !important; }`,
    });
    await page.waitForTimeout(200);

    const overflow = await horizontalOverflow(page);
    expect(overflow, `Detail přetéká o ${overflow} px`).toBeLessThanOrEqual(1);

    const violations = await analyse(page);
    expect(
      violations,
      `Přístupnost s rozestupy:
${describe(violations)}`,
    ).toEqual([]);
  });
});

test.describe("přístupnost na mobilu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("přehled slibů na úzké obrazovce", async ({ page }) => {
    await expectAccessible(page, "/promises");
  });

  test("detail slibu na úzké obrazovce", async ({ page }) => {
    await expectAccessible(page, `/promises/${PUBLISHED_SLUG}`);
  });

  test("otevřená zásuvka s filtry je dialog, ne jen odsunutý obsah", async ({ page }) => {
    await page.goto("/promises");
    await page.getByRole("button", { name: /Filtry a hledání/ }).click();

    const dialog = page.getByRole("dialog", { name: "Filtry a hledání" });
    await expect(dialog).toBeVisible();

    const violations = await analyse(page);
    expect(
      violations,
      `Přístupnost zásuvky:
${describe(violations)}`,
    ).toEqual([]);
  });
});

test.describe("přístupnost redakční konzole", () => {
  test("přihlašovací formulář", async ({ page }) => {
    await expectAccessible(page, "/admin/login");
  });

  test("přehled a detail slibu", async ({ page }) => {
    await loginAsEditor(page);

    await expectAccessible(page, "/admin");
    await expectAccessible(page, "/admin/sources");
    await expectAccessible(page, "/admin/promises");
    await expectAccessible(page, "/admin/promises/new");
    await expectAccessible(page, `/admin/promises/${PUBLISHED_SLUG}`);
  });
});

test.describe("ovladatelnost klávesnicí", () => {
  test("první tabulátor odhalí odkaz na přeskočení obsahu", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toHaveText("Přeskočit na obsah");
    // Musí být vidět, jinak je k ničemu — proto `sr-only` mizí až při fokusu.
    await expect(focused).toBeVisible();
  });

  test("z přehledu se dá klávesnicí dojít na detail slibu", async ({ page }) => {
    await page.goto("/promises");

    const firstCard = page.getByRole("heading", { level: 3 }).first().getByRole("link");
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/promises\/[a-z0-9-]+$/);
  });
});
