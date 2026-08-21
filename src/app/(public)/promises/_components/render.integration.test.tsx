/**
 * Vykreslení komponent nad skutečnými daty.
 *
 * Typový systém uhlídá, že popisek existuje pro každou hodnotu enumu. Neuhlídá
 * ale to podstatné: že se do výsledného HTML nedostane text, který se zveřejnit
 * nesmí. Proto se tady komponenty opravdu vyrenderují a hledá se v nich citace
 * z nepotvrzeného návrhu AI — ta v markupu být nesmí.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EvidenceList } from "@/app/(public)/promises/_components/EvidenceList";
import { MetricPanel } from "@/app/(public)/promises/_components/MetricPanel";
import { PromiseCard } from "@/app/(public)/promises/_components/PromiseCard";
import { Timeline } from "@/app/(public)/promises/_components/Timeline";
import { AssessabilityPanel } from "@/app/(public)/promises/_components/AssessabilityPanel";
import { reseed } from "@/db/seed/applySeed";
import { QUOTES } from "@/db/seed/demoSources";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { promiseFiltersSchema } from "@/modules/promises/filters";
import {
  getPublishedPromiseDetail,
  listPublishedPromises,
  type PromiseDetail,
} from "@/modules/promises/queries";

let handle: TestDatabaseHandle;
let byty: PromiseDetail;
let tramvaj: PromiseDetail;

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  const bytyDetail = await getPublishedPromiseDetail(
    handle.db,
    "demo-a-2000-mestskych-najemnich-bytu",
  );
  const tramvajDetail = await getPublishedPromiseDetail(
    handle.db,
    "demo-a-tramvajova-trat-do-demo-ctvrti",
  );

  if (!bytyDetail || !tramvajDetail) throw new Error("Seed neobsahuje očekávané sliby.");
  byty = bytyDetail;
  tramvaj = tramvajDetail;
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("karta slibu", () => {
  it("vykreslí kandidátku, stav i označení demo dat", async () => {
    const { items } = await listPublishedPromises(handle.db, promiseFiltersSchema.parse({}));
    const first = items[0];
    expect(first).toBeDefined();
    if (!first) return;

    const html = renderToStaticMarkup(<PromiseCard promise={first} />);

    expect(html).toContain(first.title);
    expect(html).toContain(first.electoralList.shortName);
    expect(html).toContain("demo");
  });
});

describe("detail slibu", () => {
  it("vykreslí celou časovou osu i s citacemi", () => {
    const html = renderToStaticMarkup(<Timeline events={byty.timeline} />);

    expect(html).toContain("Zkolaudováno 910 bytů z 2 000");
    expect(html).toContain(QUOTES.usneseni_byty);
    expect(html).not.toContain("zatím nemáme zdrojový dokument");
  });

  it("vypíše, které pravidlo o hodnotitelnosti rozhodlo", () => {
    expect(byty.assessment).not.toBeNull();
    if (!byty.assessment) return;

    const html = renderToStaticMarkup(<AssessabilityPanel assessment={byty.assessment} />);

    expect(html).toContain("Měřitelnost");
    expect(html).toContain("4.65");
    expect(html).toContain(byty.assessment.methodologyVersion);
  });

  it("ukáže výchozí hodnotu, cíl i naměřené číslo", () => {
    const metric = byty.metrics[0];
    expect(metric).toBeDefined();
    if (!metric) return;

    // Intl odděluje tisíce pevnou mezerou; pro porovnání ji srovnáme na obyčejnou.
    const html = renderToStaticMarkup(<MetricPanel metric={metric} />).replace(/\s/g, " ");

    expect(html).toContain("2 000 byt");
    expect(html).toContain("910 byt");
    expect(html).toContain("Zpráva o stavu městského bytového fondu");
  });

  it("do vykresleného HTML se nedostane nepotvrzený návrh AI", () => {
    const html = renderToStaticMarkup(<EvidenceList evidence={tramvaj.evidence} />);

    // Týž dokument je u slibu i s ověřenou vazbou, takže citace v HTML být má.
    expect(html).toContain(QUOTES.zprava_doprava);
    // Vazba navržená AI má typ SUPPORTS a ověřená typ PROGRESS. Popisek
    // nepotvrzené vazby se tedy nesmí objevit ani jednou.
    expect(html).toContain("Dokládá průběh");
    expect(html).not.toContain("Potvrzuje závazek");
  });

  it("u slibu bez důkazů to řekne, místo aby tvrdil něco nedoloženého", () => {
    const html = renderToStaticMarkup(<EvidenceList evidence={[]} />);

    expect(html).toContain("netvrdíme o jeho plnění nic");
  });
});
