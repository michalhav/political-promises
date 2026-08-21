import type { Metadata } from "next";
import Link from "next/link";

import {
  ASSESSABILITY_LABELS,
  EXECUTION_STATUS_LABELS,
  OUTCOME_STATUS_LABELS,
} from "@/modules/assessments/labels";
import { ASSESSABILITY_DIMENSIONS } from "@/modules/assessments/dimensions";
import { METHODOLOGY_VERSION, THRESHOLDS, WEIGHTS } from "@/modules/assessments/assessability";
import { assessabilityEnum, executionStatusEnum, outcomeStatusEnum } from "@/db/enums";

export const metadata: Metadata = {
  title: "Metodika",
  description:
    "Co považujeme za slib, jak počítáme hodnotitelnost, proč oddělujeme průběh od výsledku a jakou roli hraje AI.",
};

/**
 * Metodika.
 *
 * Váhy, prahy i popisy dimenzí se sem neopisují ručně — importují se z téhož
 * modulu, který hodnocení počítá. Kdyby se metodika psala zvlášť, po první
 * změně vah by tvrdila něco jiného, než co aplikace dělá, a celý argument
 * důvěryhodnosti by padl.
 */
export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Metodika</h1>
        <p className="text-muted">
          Tahle stránka popisuje, jak vznikají tvrzení na tomto webu. Je součástí produktu, ne
          doplňkem — bez ní nemá čtenář jak ověřit, že hodnocení není libovůle.
        </p>
        <p className="text-muted text-sm">Verze metodiky {METHODOLOGY_VERSION}.</p>
      </header>

      <Section id="co-je-slib" title="Co považujeme za slib">
        <p>
          Slibem je konkrétní závazek z volebního programu nebo jiného předvolebního dokumentu
          kandidátky, u kterého lze aspoň v principu určit, co by znamenalo jeho naplnění. Zapisuje
          se doslovným zněním ze zdroje, s odkazem na stránku nebo kapitolu.
        </p>
        <p>
          Slib patří <strong>kandidátce</strong>, ne straně. V komunálních volbách kandidují koalice
          a strany se v čase přejmenovávají i slučují; kdybychom slib vedli u strany, přestal by po
          čase patřit tomu, kdo ho vyslovil.
        </p>
        <p>
          Doslovné znění se po zveřejnění už nikdy nemění. Když je věta z programu nejasná, redakce
          k ní připíše přepis do ověřitelné podoby — ten původní znění nenahrazuje, jen ho doplňuje.
        </p>
        <p>
          Citace ukládáme přesně tak, jak stojí v dokumentu — včetně toho, jak text rozdělilo
          stránkování PDF. Při zobrazení spojujeme slova rozdělená na konci řádku a sjednocujeme
          mezery, protože dělení slova není nic, co by politik řekl; je to artefakt sazby. Mění se
          tím jen zobrazení, nikdy uložený text: co je v citaci k přečtení, jde znak po znaku najít
          ve zdrojovém dokumentu.
        </p>
      </Section>

      <Section id="hodnotitelnost" title="Jak počítáme hodnotitelnost">
        <p>
          Ne každý slib jde spravedlivě vyhodnotit. „Budeme pečovat o zeleň“ a „postavíme 2 000 bytů
          do konce volebního období“ nejsou tvrzení téhož druhu a tvářit se, že ano, by bylo
          nepoctivé. Každý slib proto dostane pět skóre od 0 do 5.
        </p>

        <dl className="divide-border divide-y">
          {ASSESSABILITY_DIMENSIONS.map((dimension) => (
            <div key={dimension.key} className="space-y-1 py-3">
              <dt className="font-medium">
                {dimension.label}{" "}
                <span className="text-muted font-normal">
                  (váha {formatWeight(WEIGHTS[dimension.key])})
                </span>
              </dt>
              <dd className="text-muted text-sm">
                {dimension.question}
                <br />0 — {dimension.lowAnchor} 5 — {dimension.highAnchor}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="font-semibold">Výpočet</h3>
        <p>
          Z pěti skóre se spočítá vážený průměr. Nad ním ale stojí ještě pravidla, protože samotný
          průměr by lhal: slib s nulovou měřitelností a pěti body ve zbytku by průměrem vyšel jako
          dobře hodnotitelný, přestože se u něj nedá říct „splněno“.
        </p>

        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Vstupní brány.</strong> Pokud je pravomoc 0 nebo 1, slib je{" "}
            <em>nehodnotitelný</em> bez ohledu na zbytek — o věci rozhoduje někdo jiný, takže
            splnění by nezáviselo na tom, kdo slib dal. Totéž platí, když je konkrétnost i
            měřitelnost nejvýše 1: to je prohlášení o směřování, ne závazek.
          </li>
          <li>
            <strong>Prahy.</strong> Vážený průměr {THRESHOLDS.HIGH.toFixed(1)} a výš znamená{" "}
            {ASSESSABILITY_LABELS.HIGH.label.toLowerCase()}, od {THRESHOLDS.MEDIUM.toFixed(1)}{" "}
            {ASSESSABILITY_LABELS.MEDIUM.label.toLowerCase()}, od {THRESHOLDS.LOW.toFixed(1)}{" "}
            {ASSESSABILITY_LABELS.LOW.label.toLowerCase()}, níž{" "}
            {ASSESSABILITY_LABELS.NOT_ASSESSABLE.label.toLowerCase()}.
          </li>
          <li>
            <strong>Stropy.</strong> Měřitelnost nejvýše 2, definice výsledku nejvýše 1 nebo úplně
            chybějící termín srazí výsledek nejvýš na{" "}
            {ASSESSABILITY_LABELS.MEDIUM.label.toLowerCase()}. Strop umí hodnocení jen snížit, nikdy
            zvýšit.
          </li>
        </ol>

        <p className="text-muted text-sm">
          Výpočet je deterministický: ze stejných pěti skóre vyjde vždy totéž. U každého slibu je na
          detailu vypsané, které pravidlo se uplatnilo. Skóre zadává člověk, výsledný stupeň nikoli.
        </p>
      </Section>

      <Section id="prubeh-vs-vysledek" title="Průběh a výsledek jsou dvě různé věci">
        <p>
          Město může slíbené opatření poctivě zrealizovat, a přesto nemusí nastat slíbený výsledek.
          A naopak — výsledek může nastat bez přičinění radnice. Kdybychom obojí slili do jednoho
          čísla, vzniklo by tvrzení, které neodpovídá ani jednomu.
        </p>

        <h3 className="font-semibold">Co nevíme, netvrdíme</h3>
        <p>
          Mezi „realizace nezačala“ a „nenašli jsme doklad, že začala“ je rozdíl, na kterém nám
          záleží. Projekt může běžet uvnitř úřadu měsíce předtím, než o něm vznikne usnesení nebo
          zpráva. Kdybychom absenci dokumentu vydávali za nečinnost, tvrdili bychom o městě něco, co
          z našich zdrojů neplyne.
        </p>
        <p>
          Proto má stav <strong>{EXECUTION_STATUS_LABELS.NO_VERIFIED_PROGRESS.label}</strong> jiný
          význam než <strong>{EXECUTION_STATUS_LABELS.NOT_STARTED.label}</strong>. První mluví o
          stavu našich zdrojů, druhý o stavu města — a druhý smí padnout jedině tehdy, když to
          nějaký dokument výslovně uvádí. Tuhle podmínku vynucují pravidla konzistence, ne dobrá
          vůle redaktora.
        </p>
        <p>
          U každého hodnocení proto uvádíme <strong>rozhodné datum</strong>: den, ke kterému jsme
          zdroje procházeli. Bez něj by byl výrok o stavu nedatovaný a zítřejší usnesení by ho tiše
          popřelo.
        </p>

        <h3 className="font-semibold">Stav plnění</h3>
        <dl className="divide-border divide-y">
          {executionStatusEnum.enumValues.map((status) => (
            <div key={status} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium">{EXECUTION_STATUS_LABELS[status].label}</dt>
              <dd className="text-muted text-sm">{EXECUTION_STATUS_LABELS[status].meaning}</dd>
            </div>
          ))}
        </dl>

        <h3 className="font-semibold">Stav výsledku</h3>
        <dl className="divide-border divide-y">
          {outcomeStatusEnum.enumValues.map((status) => (
            <div key={status} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium">{OUTCOME_STATUS_LABELS[status].label}</dt>
              <dd className="text-muted text-sm">{OUTCOME_STATUS_LABELS[status].meaning}</dd>
            </div>
          ))}
        </dl>

        <p className="text-muted text-sm">
          Stupně hodnotitelnosti:{" "}
          {assessabilityEnum.enumValues
            .map((level) => ASSESSABILITY_LABELS[level].label.toLowerCase())
            .join(", ")}
          .
        </p>
      </Section>

      <Section id="dukazy" title="Co musí být doložené">
        <p>
          Každé publikované tvrzení odkazuje na zdrojový dokument. U zdroje uchováváme adresu,
          vydavatele, datum vydání, datum stažení a otisk obsahu, aby šlo i po letech ověřit, s
          jakým textem jsme pracovali.
        </p>
        <p>
          Tvrzení, že se něco stalo — že realizace běží, byla zastavena nebo od záměru se ustoupilo
          — nesmí vzniknout bez aspoň jednoho ověřeného zdroje. Tvrzení o výsledku (dosaženo,
          částečně dosaženo, nedosaženo) navíc vyžaduje naměřenou hodnotu z dokumentu, ne odhad
          redakce.
        </p>
        <p>
          Opačně to neplatí: že se něco <em>nestalo</em>, zdrojem doložit obvykle nejde. Když doklad
          o realizaci nemáme, řekneme přesně to — ne že se nic nedělo.
        </p>
        <p>
          U volebních programů, koaličních smluv a usnesení ukládáme celý text. U chráněných děl,
          typicky novinových článků, uchováváme pouze odkaz a krátký citát v rozsahu, který dovoluje
          citační licence.
        </p>
      </Section>

      <Section id="ai" title="Jakou roli hraje umělá inteligence">
        <p>
          AI pomáhá s vytěžováním kandidátů na sliby z dlouhých dokumentů a s návrhy, který zdroj by
          se mohl ke kterému slibu vztahovat. To je vyhledávací práce, ne hodnocení.
        </p>
        <p>
          <strong>Žádný výstup AI se nezveřejňuje sám od sebe.</strong> Dokud návrh neprojde
          člověkem, existuje jen v interní frontě a na veřejných stránkách není vidět. U každého
          návrhu se ukládá poskytovatel, model, verze promptu a čas, aby šlo zpětně dohledat, co
          systém navrhl a proč.
        </p>
        <p>Stav plnění ani stav výsledku nikdy neurčuje model. Určuje ho redakce.</p>
      </Section>

      <Section id="revize" title="Lidská revize">
        <p>
          Hodnocení vytváří jeden člověk a schvaluje ho jiný. Databáze to vynucuje: záznam, kde je
          autor a schvalovatel tatáž osoba, nelze uložit.
        </p>
        <p>
          Hodnocení se nikdy nepřepisuje. Když se změní, vznikne nová verze s uvedeným důvodem změny
          a starší verze zůstává čitelná. Totéž platí pro záznamy o redakčních rozhodnutích — smazat
          je nejde.
        </p>
      </Section>

      <Section id="opravy" title="Opravy a právo na odpověď">
        <p>
          Když najdete chybu, opravíme ji a napíšeme u slibu, co se změnilo a proč. Podnět i naši
          odpověď zveřejňujeme u konkrétního slibu, ne někde v archivu.
        </p>
        <p>
          Kandidátka, které se hodnocení týká, může poslat reakci. Zveřejňujeme ji i tehdy, když s
          ní nesouhlasíme — čtenář má vidět obě strany a rozhodnout se sám.
        </p>
      </Section>

      <Section id="limity" title="Co tahle metodika neumí">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Nepočítáme žádné souhrnné skóre důvěryhodnosti stran. Součet nesplněných slibů není
            měřítko kvality politiky a jako číslo by svedl k závěru, který data neunesou.
          </li>
          <li>Neposuzujeme, jestli byl slib dobrý nápad. Sledujeme jen to, co se s ním stalo.</li>
          <li>
            Nedovozujeme úmysl. Nesplněný slib může být důsledek okolností, jiné priority nebo
            rozhodnutí někoho jiného — a z dokumentů se to většinou nepozná.
          </li>
          <li>
            Bodování pěti dimenzí dělá člověk, takže obsahuje úsudek. Zveřejňujeme proto všechna
            dílčí skóre, aby šlo náš úsudek zkontrolovat, ne jen výsledek.
          </li>
          <li>
            Náš přehled zdrojů není úplný a vždycky bude pozadu za skutečností. Když nějaký dokument
            nemáme, projeví se to jako „nemáme doklad“, ne jako „nestalo se“ — a u každého hodnocení
            je vidět, k jakému datu to platí.
          </li>
        </ul>
      </Section>

      <p className="text-muted border-border border-t pt-8 text-sm">
        Máte k metodice připomínku nebo jste našli chybu v konkrétním hodnocení? Napište nám —
        opravy zveřejňujeme u{" "}
        <Link href="/promises" className="hover:text-accent underline underline-offset-4">
          slibu
        </Link>
        , kterého se týkají.
      </p>
    </div>
  );
}

function formatWeight(weight: number): string {
  return `${Math.round(weight * 100)} %`;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
