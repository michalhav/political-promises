/**
 * Extraktor z předpřipravených odpovědí.
 *
 * Existuje ze dvou důvodů. Zaprvé evaluační aparát musí jít otestovat na
 * vstupu, o kterém přesně víme, co obsahuje — včetně vymyšlené citace, kterou
 * v dokumentu nikdo nenajde. Zadruhé až přibude jazykový model, půjde jeho
 * uloženou odpověď pustit přes tentýž aparát bez placení za každý běh.
 *
 * Kandidáty **needituje ani neopravuje**. Kdyby fixtura tiše dorovnávala
 * rozsahy nebo citace, evaluace by přestala měřit to, co model doopravdy
 * vrátil — a vymyšlená citace je právě to, co chceme umět zachytit.
 */
import type { ExtractionCandidate, PromiseExtractor } from "@/modules/extraction/types";

export class FixturePromiseExtractor implements PromiseExtractor {
  readonly name: string;
  readonly version: string;

  private readonly candidates: ExtractionCandidate[];

  constructor(candidates: ExtractionCandidate[], name = "fixture", version = "1.0.0") {
    this.candidates = candidates;
    this.name = name;
    this.version = version;
  }

  // Dokument se nepoužívá schválně: fixtura vrací přesně to, co dostala.
  extract(): Promise<ExtractionCandidate[]> {
    return Promise.resolve(this.candidates);
  }
}
