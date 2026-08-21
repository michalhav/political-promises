/**
 * Ukázkový dataset, který dohromady předvádí celý produkt: od věty ve volebním
 * programu přes koaliční smlouvu, usnesení, rozpočet a zakázku až po naměřený
 * výsledek, opravu a novou verzi hodnocení.
 *
 * Strany, osoby i dokumenty jsou smyšlené (rozhodnutí C1 v briefu). Schéma je
 * ale stejné, jaké unese reálná pražská data — nic tu není zjednodušené kvůli
 * tomu, že jde o demo.
 *
 * Hodnotitelnost se tu nezadává ručně: počítá ji `deriveAssessability`, tedy
 * tentýž kód, který ji počítá v aplikaci. Seed proto nemůže obsahovat stupeň,
 * který by algoritmus nevrátil.
 */
import { seedId } from "@/db/seed/ids";
import type { appUsers } from "@/modules/accounts/schema";
import type { aiRuns, aiSuggestions } from "@/modules/ai/schema";
import { deriveAssessability, type AssessabilityScores } from "@/modules/assessments/assessability";
import type { promiseAssessments } from "@/modules/assessments/schema";
import type { coalitionPromiseMappings } from "@/modules/coalition/schema";
import type {
  evidence as evidenceTable,
  promiseEventEvidence,
  promiseEvidence,
} from "@/modules/evidence/schema";
import type { elections, jurisdictions } from "@/modules/jurisdictions/schema";
import type {
  electoralListParties,
  electoralLists,
  parties,
  partyLineage,
  personRoles,
  persons,
} from "@/modules/parties/schema";
import type {
  metricMeasurements,
  promiseEvents,
  promiseMetrics,
  promises,
  promiseSources,
} from "@/modules/promises/schema";
import type { auditLogs, corrections, reviewDecisions } from "@/modules/review/schema";
import type { sourceDocuments } from "@/modules/sources/schema";

import { contentHash } from "@/db/seed/ids";
import { DEMO_SOURCE_DOCUMENTS, QUOTES, SOURCE_KEYS, sourceId } from "@/db/seed/demoSources";

// ---------------------------------------------------------------------------
// Identifikátory
// ---------------------------------------------------------------------------

const userId = (key: string): string => seedId(`user:${key}`);
const partyId = (key: string): string => seedId(`party:${key}`);
const listId = (key: string): string => seedId(`electoral-list:${key}`);
const personId = (key: string): string => seedId(`person:${key}`);
const promiseId = (key: string): string => seedId(`promise:${key}`);
const evidenceId = (key: string): string => seedId(`evidence:${key}`);
const metricId = (key: string): string => seedId(`metric:${key}`);
const aiRunId = (key: string): string => seedId(`ai-run:${key}`);
const aiSuggestionId = (key: string): string => seedId(`ai-suggestion:${key}`);
const assessmentId = (promiseKey: string, version: number): string =>
  seedId(`assessment:${promiseKey}:v${version}`);

const JURISDICTION_ID = seedId("jurisdiction:praha");
const ELECTION_ID = seedId("election:praha-2022");
const REVIEWED_AT = new Date("2026-03-10T10:00:00.000Z");
const PUBLISHED_AT = new Date("2026-03-10T12:00:00.000Z");

const USER_EDITOR = userId("redaktor-1");
const USER_REVIEWER = userId("redaktor-2");

// ---------------------------------------------------------------------------
// Základní entity
// ---------------------------------------------------------------------------

const demoUsers: (typeof appUsers.$inferInsert)[] = [
  {
    id: USER_EDITOR,
    email: "redaktor1@example.org",
    displayName: "Demo redaktor 1",
  },
  {
    id: USER_REVIEWER,
    email: "redaktor2@example.org",
    displayName: "Demo redaktor 2",
  },
];

const demoJurisdictions: (typeof jurisdictions.$inferInsert)[] = [
  {
    id: JURISDICTION_ID,
    slug: "praha",
    name: "Praha",
    type: "MUNICIPALITY",
    countryCode: "CZ",
  },
];

const demoElections: (typeof elections.$inferInsert)[] = [
  {
    id: ELECTION_ID,
    jurisdictionId: JURISDICTION_ID,
    slug: "komunalni-volby-praha-2022",
    name: "Komunální volby v Praze 2022",
    electionDate: "2022-09-23",
    termStart: "2022-10-01",
    termEnd: "2026-10-02",
  },
];

const demoParties: (typeof parties.$inferInsert)[] = [
  {
    id: partyId("a"),
    slug: "demo-strana-a",
    name: "Demo strana A",
    shortName: "Demo A",
    isDemo: true,
  },
  {
    id: partyId("b"),
    slug: "demo-strana-b",
    name: "Demo strana B",
    shortName: "Demo B",
    isDemo: true,
  },
  {
    id: partyId("c"),
    slug: "demo-strana-c",
    name: "Demo strana C",
    shortName: "Demo C",
    foundedOn: "2021-06-01",
    isDemo: true,
  },
  {
    id: partyId("d"),
    slug: "demo-strana-d",
    name: "Demo strana D",
    shortName: "Demo D",
    isDemo: true,
  },
  {
    id: partyId("c-puvodni"),
    slug: "demo-hnuti-c",
    name: "Demo hnutí C",
    shortName: "Demo hnutí C",
    dissolvedOn: "2021-06-01",
    isDemo: true,
  },
];

/** A1 — přejmenování subjektu. Slib z roku 2022 musí zůstat u toho, kdo ho vyslovil. */
const demoPartyLineage: (typeof partyLineage.$inferInsert)[] = [
  {
    id: seedId("lineage:c"),
    fromPartyId: partyId("c-puvodni"),
    toPartyId: partyId("c"),
    relationType: "RENAMED_TO",
    effectiveOn: "2021-06-01",
    sourceDocumentId: sourceId(SOURCE_KEYS.rejstrik),
    note: "Změna názvu zapsaná v rejstříku, subjekt zůstal totožný.",
  },
];

const LIST_A = "demo-a-2022";
const LIST_BC = "demo-bc-2022";
const LIST_D = "demo-d-2022";

const demoElectoralLists: (typeof electoralLists.$inferInsert)[] = [
  {
    id: listId(LIST_A),
    electionId: ELECTION_ID,
    slug: LIST_A,
    name: "Demo strana A",
    shortName: "Demo A",
    ballotNumber: 1,
    seatsWon: 21,
  },
  {
    id: listId(LIST_BC),
    electionId: ELECTION_ID,
    slug: LIST_BC,
    name: "Demo koalice B+C",
    shortName: "Demo B+C",
    ballotNumber: 2,
    seatsWon: 18,
  },
  {
    id: listId(LIST_D),
    electionId: ELECTION_ID,
    slug: LIST_D,
    name: "Demo strana D",
    shortName: "Demo D",
    ballotNumber: 3,
    seatsWon: 26,
  },
];

const demoElectoralListParties: (typeof electoralListParties.$inferInsert)[] = [
  {
    id: seedId("elp:a"),
    electoralListId: listId(LIST_A),
    partyId: partyId("a"),
    displayOrder: 0,
  },
  {
    id: seedId("elp:bc-b"),
    electoralListId: listId(LIST_BC),
    partyId: partyId("b"),
    displayOrder: 0,
  },
  {
    id: seedId("elp:bc-c"),
    electoralListId: listId(LIST_BC),
    partyId: partyId("c"),
    displayOrder: 1,
  },
  {
    id: seedId("elp:d"),
    electoralListId: listId(LIST_D),
    partyId: partyId("d"),
    displayOrder: 0,
  },
];

const demoPersons: (typeof persons.$inferInsert)[] = [
  { id: personId("a1"), slug: "demo-osoba-a1", fullName: "Demo osoba A1" },
  { id: personId("b1"), slug: "demo-osoba-b1", fullName: "Demo osoba B1" },
  { id: personId("d1"), slug: "demo-osoba-d1", fullName: "Demo osoba D1" },
];

/** Přeběh mezi kluby: ukončená role a nová role, nikdy přepsaný řádek. */
const demoPersonRoles: (typeof personRoles.$inferInsert)[] = [
  {
    id: seedId("role:a1-primator"),
    personId: personId("a1"),
    electionId: ELECTION_ID,
    electoralListId: listId(LIST_A),
    partyId: partyId("a"),
    roleType: "MAYOR",
    startedOn: "2022-10-01",
  },
  {
    id: seedId("role:b1-namestek"),
    personId: personId("b1"),
    electionId: ELECTION_ID,
    electoralListId: listId(LIST_BC),
    partyId: partyId("b"),
    roleType: "DEPUTY_MAYOR",
    startedOn: "2022-10-01",
  },
  {
    id: seedId("role:d1-zastupitel-d"),
    personId: personId("d1"),
    electionId: ELECTION_ID,
    electoralListId: listId(LIST_D),
    partyId: partyId("d"),
    roleType: "COUNCILLOR",
    startedOn: "2022-10-01",
    endedOn: "2024-03-01",
  },
  {
    id: seedId("role:d1-zastupitel-c"),
    personId: personId("d1"),
    electionId: ELECTION_ID,
    electoralListId: listId(LIST_D),
    partyId: partyId("c"),
    roleType: "COUNCILLOR",
    startedOn: "2024-03-02",
  },
];

// ---------------------------------------------------------------------------
// Důkazy
//
// Definované centrálně, protože jeden důkaz může patřit k víc slibům (A5) —
// například rozpočtová položka, ze které se financují dva různé závazky.
// ---------------------------------------------------------------------------

interface DemoEvidenceInput {
  sourceKey: string;
  excerpt: string;
  pageNumber?: number;
  locator?: string;
}

const EVIDENCE_INPUTS = {
  "program-a-byty": {
    sourceKey: SOURCE_KEYS.programA,
    excerpt: QUOTES.programA_byty,
    pageNumber: 4,
    locator: "kapitola Bydlení",
  },
  "program-a-tramvaj": {
    sourceKey: SOURCE_KEYS.programA,
    excerpt: QUOTES.programA_tramvaj,
    pageNumber: 9,
    locator: "kapitola Doprava",
  },
  "program-a-skolky": {
    sourceKey: SOURCE_KEYS.programA,
    excerpt: QUOTES.programA_skolky,
    pageNumber: 13,
    locator: "kapitola Školství",
  },
  "program-a-zelen": {
    sourceKey: SOURCE_KEYS.programA,
    excerpt: QUOTES.programA_zelen,
    pageNumber: 17,
    locator: "kapitola Životní prostředí",
  },
  "program-a-dph": {
    sourceKey: SOURCE_KEYS.programA,
    excerpt: QUOTES.programA_dph,
    pageNumber: 21,
    locator: "kapitola Veřejné finance",
  },
  "program-bc-parkovani": {
    sourceKey: SOURCE_KEYS.programBC,
    excerpt: QUOTES.programBC_parkovani,
    pageNumber: 6,
    locator: "kapitola Doprava a parkování",
  },
  "program-bc-digital": {
    sourceKey: SOURCE_KEYS.programBC,
    excerpt: QUOTES.programBC_digital,
    pageNumber: 14,
    locator: "kapitola Digitalizace",
  },
  "program-bc-seniori": {
    sourceKey: SOURCE_KEYS.programBC,
    excerpt: QUOTES.programBC_seniori,
    pageNumber: 19,
    locator: "kapitola Sociální politika",
  },
  "program-bc-dluh": {
    sourceKey: SOURCE_KEYS.programBC,
    excerpt: QUOTES.programBC_dluh,
    pageNumber: 24,
    locator: "kapitola Hospodaření města",
  },
  "program-d-kamery": {
    sourceKey: SOURCE_KEYS.programD,
    excerpt: QUOTES.programD_kamery,
    pageNumber: 5,
    locator: "kapitola Bezpečnost",
  },
  "program-d-brownfieldy": {
    sourceKey: SOURCE_KEYS.programD,
    excerpt: QUOTES.programD_brownfieldy,
    pageNumber: 11,
    locator: "kapitola Rozvoj města",
  },
  "koalice-byty": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_byty,
    pageNumber: 2,
    locator: "čl. I",
  },
  "koalice-seniori": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_seniori,
    pageNumber: 2,
    locator: "čl. I",
  },
  "koalice-tramvaj": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_tramvaj,
    pageNumber: 4,
    locator: "čl. II",
  },
  "koalice-parkovani": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_parkovani,
    pageNumber: 4,
    locator: "čl. II",
  },
  "koalice-skolky": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_skolky,
    pageNumber: 6,
    locator: "čl. III",
  },
  "koalice-digital": {
    sourceKey: SOURCE_KEYS.koalicniSmlouva,
    excerpt: QUOTES.koalice_digital,
    pageNumber: 8,
    locator: "čl. IV",
  },
  "usneseni-byty": {
    sourceKey: SOURCE_KEYS.usneseniByty,
    excerpt: QUOTES.usneseni_byty,
    locator: "bod 1",
  },
  "usneseni-skolky": {
    sourceKey: SOURCE_KEYS.usneseniByty,
    excerpt: QUOTES.usneseni_skolky,
    locator: "bod 2",
  },
  "usneseni-dluh": {
    sourceKey: SOURCE_KEYS.usneseniDluh,
    excerpt: QUOTES.usneseni_dluh,
    locator: "bod 1",
  },
  "rozpocet-byty": {
    sourceKey: SOURCE_KEYS.rozpocet,
    excerpt: QUOTES.rozpocet_byty,
    pageNumber: 71,
    locator: "kapitola 08",
  },
  "rozpocet-skolky": {
    sourceKey: SOURCE_KEYS.rozpocet,
    excerpt: QUOTES.rozpocet_skolky,
    pageNumber: 44,
    locator: "kapitola 04",
  },
  "zakazka-byty": {
    sourceKey: SOURCE_KEYS.zakazkaByty,
    excerpt: QUOTES.zakazka_byty,
    locator: "předmět zakázky",
  },
  "zakazka-parkovani": {
    sourceKey: SOURCE_KEYS.zakazkaParkovani,
    excerpt: QUOTES.zakazka_parkovani,
    locator: "oznámení o přerušení",
  },
  "smlouva-byty": {
    sourceKey: SOURCE_KEYS.smlouvaByty,
    excerpt: QUOTES.smlouva_byty,
    locator: "čl. III odst. 2",
  },
  "zprava-byty": {
    sourceKey: SOURCE_KEYS.zpravaBydleni,
    excerpt: QUOTES.zprava_byty,
    pageNumber: 12,
  },
  "zprava-skolky": {
    sourceKey: SOURCE_KEYS.zpravaBydleni,
    excerpt: QUOTES.zprava_skolky,
    pageNumber: 27,
  },
  "zprava-dluh": {
    sourceKey: SOURCE_KEYS.zpravaBydleni,
    excerpt: QUOTES.zprava_dluh,
    pageNumber: 38,
  },
  "zprava-doprava": {
    sourceKey: SOURCE_KEYS.zpravaDoprava,
    excerpt: QUOTES.zprava_doprava,
    pageNumber: 7,
  },
  "clanek-vystavba": {
    sourceKey: SOURCE_KEYS.clanek,
    excerpt: QUOTES.clanek_vystavba,
  },
} as const satisfies Record<string, DemoEvidenceInput>;

type EvidenceKey = keyof typeof EVIDENCE_INPUTS;

const demoEvidence: (typeof evidenceTable.$inferInsert)[] = (
  Object.entries(EVIDENCE_INPUTS) as [EvidenceKey, DemoEvidenceInput][]
).map(([key, input]) => ({
  id: evidenceId(key),
  sourceDocumentId: sourceId(input.sourceKey),
  excerpt: input.excerpt,
  pageNumber: input.pageNumber ?? null,
  locator: input.locator ?? null,
}));

// ---------------------------------------------------------------------------
// Sliby
// ---------------------------------------------------------------------------

type RelationType = (typeof promiseEvidence.$inferInsert)["relationType"];
type EventType = (typeof promiseEvents.$inferInsert)["eventType"];
type MetricDirection = (typeof promiseMetrics.$inferInsert)["direction"];

interface DemoEvidenceLink {
  evidenceKey: EvidenceKey;
  relationType: RelationType;
  /** Co zdroj dokládá. */
  note?: string;
  /** Co z něj naopak vyvodit nelze. */
  limitationNote?: string;
  /** Nepotvrzená vazba = návrh AI. Veřejně se nezobrazuje. */
  humanVerified?: false;
  aiSuggestionKey?: string;
  confidence?: string;
}

interface DemoEvent {
  eventType: EventType;
  eventDate: string;
  title: string;
  description?: string;
  evidenceKeys: EvidenceKey[];
}

interface DemoMeasurement {
  value: string;
  measuredOn: string;
  sourceKey: string;
  note?: string;
}

interface DemoMetric {
  key: string;
  name: string;
  unit: string;
  direction: MetricDirection;
  baselineValue: string;
  baselineOn: string;
  targetValue: string;
  targetOn: string;
  definitionNote: string;
  sourceKey?: string;
  measurements: DemoMeasurement[];
}

interface DemoAssessmentVersion {
  scores: AssessabilityScores;
  executionStatus: (typeof promiseAssessments.$inferInsert)["executionStatus"];
  outcomeStatus: (typeof promiseAssessments.$inferInsert)["outcomeStatus"];
  summary: string;
  changeReason?: string;
  createdAt: string;
  /** Ke kterému dni sahá rešerše zdrojů. Bez uvedení se bere den vzniku hodnocení. */
  sourcesReviewedUpTo?: string;
}

interface DemoCoalitionMapping {
  classification: (typeof coalitionPromiseMappings.$inferInsert)["classification"];
  reason: string;
  evidenceKey?: EvidenceKey;
}

interface DemoPromise {
  key: string;
  listKey: string;
  slug: string;
  title: string;
  originalText: string;
  normalizedStatement: string | null;
  topic: (typeof promises.$inferInsert)["topic"];
  deadlineText: string | null;
  deadlineOn: string | null;
  primarySource: { sourceKey: string; excerpt: string; pageNumber?: number; locator?: string };
  published: boolean;
  aiSuggestionKey?: string;
  assessments?: DemoAssessmentVersion[];
  evidenceLinks?: DemoEvidenceLink[];
  events?: DemoEvent[];
  metrics?: DemoMetric[];
  coalition?: DemoCoalitionMapping;
}

const DEMO_PROMISES: DemoPromise[] = [
  {
    key: "byty",
    listKey: LIST_A,
    slug: "demo-a-2000-mestskych-najemnich-bytu",
    title: "2 000 nových městských nájemních bytů",
    originalText: QUOTES.programA_byty,
    normalizedStatement:
      "Do konce volebního období 2022–2026 zkolaudovat 2 000 nových nájemních bytů, které zůstanou ve vlastnictví města.",
    topic: "HOUSING",
    deadlineText: "do konce volebního období",
    deadlineOn: "2026-10-02",
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_byty,
      pageNumber: 4,
      locator: "kapitola Bydlení",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 5,
          deadlineScore: 4,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 4,
        },
        executionStatus: "IN_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Program byl schválen, zafinancován a první etapa se staví. K datu hodnocení nebyla zveřejněna žádná souhrnná čísla o dokončených bytech.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 5,
          deadlineScore: 4,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 4,
        },
        executionStatus: "PARTIALLY_COMPLETED",
        outcomeStatus: "PARTIALLY_ACHIEVED",
        summary:
          "Podle zprávy o bytovém fondu bylo k 31. 12. 2025 zkolaudováno 910 bytů z 2 000 slíbených. Realizace pokračuje, cílová hodnota zatím dosažena není.",
        changeReason:
          "Vyšla zpráva o stavu bytového fondu za rok 2025 s konkrétním počtem zkolaudovaných bytů. Doplnili jsme naměřenou hodnotu a upravili stav plnění i stav výsledku.",
        createdAt: "2026-06-20T09:30:00.000Z",
        // Rešerše skončila dřív, než hodnocení prošlo revizí a vyšlo.
        sourcesReviewedUpTo: "2026-06-15",
      },
    ],
    metrics: [
      {
        key: "byty-zkolaudovane",
        name: "Zkolaudované nájemní byty ve vlastnictví města",
        unit: "byt",
        direction: "INCREASE",
        baselineValue: "0",
        baselineOn: "2022-10-01",
        targetValue: "2000",
        targetOn: "2026-10-02",
        definitionNote:
          "Počítáme byty zkolaudované v rámci programu Městský nájemní fond, které zůstaly v majetku města. Nezapočítáváme byty pořízené odkupem ani rekonstrukce stávajícího fondu.",
        sourceKey: SOURCE_KEYS.programA,
        measurements: [
          {
            value: "910",
            measuredOn: "2025-12-31",
            sourceKey: SOURCE_KEYS.zpravaBydleni,
            note: "Údaj ze souhrnné zprávy města za rok 2025.",
          },
        ],
      },
    ],
    evidenceLinks: [
      { evidenceKey: "koalice-byty", relationType: "SUPPORTS" },
      { evidenceKey: "usneseni-byty", relationType: "IMPLEMENTATION" },
      {
        evidenceKey: "rozpocet-byty",
        relationType: "FUNDING",
        note: "Rozpočet na rok 2024 vyčleňuje na program 600 mil. Kč.",
        limitationNote: "Vyčlenění peněz není doklad o tom, že byly utraceny nebo že vznikly byty.",
      },
      { evidenceKey: "zakazka-byty", relationType: "PROGRESS" },
      { evidenceKey: "smlouva-byty", relationType: "IMPLEMENTATION" },
      { evidenceKey: "clanek-vystavba", relationType: "PROGRESS" },
      {
        evidenceKey: "zprava-byty",
        relationType: "OUTCOME",
        note: "Zpráva města uvádí počet bytů zkolaudovaných v rámci programu k 31. 12. 2025.",
        limitationNote:
          "Sama o sobě neříká nic o dosažení slíbených 2 000 bytů ani o tempu zbývající výstavby.",
      },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-15",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-a-byty"],
      },
      {
        eventType: "COALITION_INCLUDED",
        eventDate: "2022-11-04",
        title: "Závazek převzat do koaliční smlouvy",
        description:
          "Koaliční smlouva přebírá počet 2 000 bytů i podmínku ponechání v majetku města.",
        evidenceKeys: ["koalice-byty"],
      },
      {
        eventType: "COUNCIL_DECISION",
        eventDate: "2023-06-15",
        title: "Zastupitelstvo schválilo investiční program",
        evidenceKeys: ["usneseni-byty"],
      },
      {
        eventType: "BUDGET_ALLOCATED",
        eventDate: "2023-12-14",
        title: "V rozpočtu na rok 2024 vyčleněno 600 mil. Kč",
        evidenceKeys: ["rozpocet-byty"],
      },
      {
        eventType: "PROCUREMENT_STARTED",
        eventDate: "2024-03-11",
        title: "Vyhlášena zakázka na první etapu, 340 bytů",
        evidenceKeys: ["zakazka-byty"],
      },
      {
        eventType: "CONTRACT_SIGNED",
        eventDate: "2024-07-30",
        title: "Podepsána smlouva o dílo",
        evidenceKeys: ["smlouva-byty"],
      },
      {
        eventType: "IMPLEMENTATION_STARTED",
        eventDate: "2024-09-02",
        title: "Zahájena výstavba v lokalitě Demo sever",
        evidenceKeys: ["clanek-vystavba"],
      },
      {
        eventType: "MILESTONE_REACHED",
        eventDate: "2026-01-31",
        title: "Zkolaudováno 910 bytů z 2 000",
        evidenceKeys: ["zprava-byty"],
      },
    ],
    coalition: {
      classification: "RETAINED",
      reason:
        "Koaliční smlouva přebírá číselný závazek 2 000 bytů i podmínku ponechání bytů v majetku města. Formulace se liší, obsah nikoli.",
      evidenceKey: "koalice-byty",
    },
  },
  {
    key: "tramvaj",
    listKey: LIST_A,
    slug: "demo-a-tramvajova-trat-do-demo-ctvrti",
    title: "Zahájení stavby tramvajové trati do Demo čtvrti",
    originalText: QUOTES.programA_tramvaj,
    normalizedStatement:
      "Zahájit stavební práce na tramvajové trati do Demo čtvrti do konce roku 2025.",
    topic: "TRANSPORT",
    deadlineText: "nejpozději v roce 2025",
    deadlineOn: "2025-12-31",
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_tramvaj,
      pageNumber: 9,
      locator: "kapitola Doprava",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 4,
          deadlineScore: 3,
          jurisdictionScore: 4,
          outcomeDefinitionScore: 3,
        },
        executionStatus: "IN_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Stavba byla podle zprávy města zahájena v červnu 2025, tedy v termínu. Slib se týká zahájení, ne dokončení; výsledek proto zatím nelze měřit.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [
      { evidenceKey: "koalice-tramvaj", relationType: "CONTEXT" },
      { evidenceKey: "zprava-doprava", relationType: "PROGRESS" },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-15",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-a-tramvaj"],
      },
      {
        eventType: "COALITION_MODIFIED",
        eventDate: "2022-11-04",
        title: "V koaliční smlouvě zůstal obecný příslib přípravy",
        description: "Konkrétní trať ani termín 2025 se do koaliční smlouvy nedostaly.",
        evidenceKeys: ["koalice-tramvaj"],
      },
      {
        eventType: "IMPLEMENTATION_STARTED",
        eventDate: "2025-06-02",
        title: "Zahájena stavba trati",
        evidenceKeys: ["zprava-doprava"],
      },
    ],
    coalition: {
      classification: "MODIFIED",
      reason:
        "Koaliční smlouva mluví obecně o přípravě tratí do rozvojových oblastí a podmiňuje ji možnostmi rozpočtu. Konkrétní trať ani termín v ní nejsou.",
      evidenceKey: "koalice-tramvaj",
    },
  },
  {
    key: "skolky",
    listKey: LIST_A,
    slug: "demo-a-1200-mist-v-materskych-skolach",
    title: "O 1 200 míst více v mateřských školách",
    originalText: QUOTES.programA_skolky,
    normalizedStatement:
      "Do konce roku 2026 navýšit kapacitu mateřských škol zřizovaných městem o 1 200 míst oproti stavu v roce 2022.",
    topic: "EDUCATION",
    deadlineText: "do roku 2026",
    deadlineOn: "2026-12-31",
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_skolky,
      pageNumber: 13,
      locator: "kapitola Školství",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 5,
          deadlineScore: 3,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 4,
        },
        executionStatus: "COMPLETED",
        outcomeStatus: "ACHIEVED",
        summary:
          "Zpráva města uvádí ve školním roce 2025/2026 navýšení o 1 265 míst oproti roku 2022, tedy nad slíbenou hodnotu 1 200.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    metrics: [
      {
        key: "skolky-kapacita",
        name: "Navýšení kapacity mateřských škol zřizovaných městem",
        unit: "místo",
        direction: "INCREASE",
        baselineValue: "0",
        baselineOn: "2022-10-01",
        targetValue: "1200",
        targetOn: "2026-12-31",
        definitionNote:
          "Rozdíl kapacity oproti školnímu roku 2022/2023. Započítávají se pouze školky zřizované městem, ne soukromé ani firemní.",
        sourceKey: SOURCE_KEYS.programA,
        measurements: [
          {
            value: "1265",
            measuredOn: "2025-09-01",
            sourceKey: SOURCE_KEYS.zpravaBydleni,
            note: "Stav k začátku školního roku 2025/2026.",
          },
        ],
      },
    ],
    evidenceLinks: [
      { evidenceKey: "koalice-skolky", relationType: "SUPPORTS" },
      { evidenceKey: "usneseni-skolky", relationType: "IMPLEMENTATION" },
      { evidenceKey: "rozpocet-skolky", relationType: "FUNDING" },
      { evidenceKey: "zprava-skolky", relationType: "OUTCOME" },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-15",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-a-skolky"],
      },
      {
        eventType: "COALITION_INCLUDED",
        eventDate: "2022-11-04",
        title: "Závazek převzat do koaliční smlouvy",
        evidenceKeys: ["koalice-skolky"],
      },
      {
        eventType: "COUNCIL_DECISION",
        eventDate: "2023-06-15",
        title: "Zastupitelstvo schválilo navýšení kapacit",
        evidenceKeys: ["usneseni-skolky"],
      },
      {
        eventType: "BUDGET_ALLOCATED",
        eventDate: "2023-12-14",
        title: "V rozpočtu na rok 2024 vyčleněno 310 mil. Kč",
        evidenceKeys: ["rozpocet-skolky"],
      },
      {
        eventType: "COMPLETED",
        eventDate: "2026-01-31",
        title: "Kapacita navýšena o 1 265 míst",
        evidenceKeys: ["zprava-skolky"],
      },
    ],
    coalition: {
      classification: "RETAINED",
      reason:
        "Koaliční smlouva přebírá číslo 1 200 míst beze změny a přidává navíc závazek k družinám.",
      evidenceKey: "koalice-skolky",
    },
  },
  {
    key: "zelen",
    listKey: LIST_A,
    slug: "demo-a-pece-o-mestskou-zelen",
    title: "Péče o městskou zeleň",
    originalText: QUOTES.programA_zelen,
    normalizedStatement: null,
    topic: "ENVIRONMENT",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_zelen,
      pageNumber: 17,
      locator: "kapitola Životní prostředí",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 1,
          measurabilityScore: 1,
          deadlineScore: 0,
          jurisdictionScore: 4,
          outcomeDefinitionScore: 1,
        },
        executionStatus: "NOT_ASSESSABLE",
        outcomeStatus: "NOT_APPLICABLE",
        summary:
          "Věta popisuje směřování, ne konkrétní opatření. Nelze určit, co by znamenalo splnění, proto slib nehodnotíme.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-15",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-a-zelen"],
      },
    ],
    coalition: {
      classification: "UNCLEAR",
      reason:
        "Koaliční smlouva obsahuje obecné pasáže o veřejném prostoru, které nelze jednoznačně přiřadit právě k tomuto slibu.",
    },
  },
  {
    key: "dph",
    listKey: LIST_A,
    slug: "demo-a-snizeni-dph-na-stavebni-prace",
    title: "Snížení DPH na stavební práce u dostupného bydlení",
    originalText: QUOTES.programA_dph,
    normalizedStatement: null,
    topic: "PUBLIC_FINANCE",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_dph,
      pageNumber: 21,
      locator: "kapitola Veřejné finance",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 4,
          measurabilityScore: 4,
          deadlineScore: 1,
          jurisdictionScore: 1,
          outcomeDefinitionScore: 3,
        },
        executionStatus: "NOT_ASSESSABLE",
        outcomeStatus: "NOT_APPLICABLE",
        summary:
          "Sazbu DPH stanoví zákon, tedy Parlament. Splnění by nezáviselo na tom, kdo slib dal, proto ho nehodnotíme.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-15",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-a-dph"],
      },
    ],
    coalition: {
      classification: "NOT_INCLUDED",
      reason: "Koaliční smlouva se k dani z přidané hodnoty nevyjadřuje.",
    },
  },
  {
    key: "parkovani",
    listKey: LIST_BC,
    slug: "demo-bc-tri-parkovaci-domy-u-metra",
    title: "Tři parkovací domy u konečných stanic metra",
    originalText: QUOTES.programBC_parkovani,
    normalizedStatement:
      "Zkolaudovat tři parkovací domy u konečných stanic metra a zavést jednotné parkovací předplatné.",
    topic: "TRANSPORT",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programBC,
      excerpt: QUOTES.programBC_parkovani,
      pageNumber: 6,
      locator: "kapitola Doprava a parkování",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 4,
          measurabilityScore: 5,
          deadlineScore: 2,
          jurisdictionScore: 4,
          outcomeDefinitionScore: 3,
        },
        executionStatus: "BLOCKED",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Zadávací řízení na první parkovací dům bylo v květnu 2025 přerušeno kvůli námitkám. Do rozhodnutí o námitkách se v realizaci nepokračuje.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [
      { evidenceKey: "koalice-parkovani", relationType: "CONTEXT" },
      { evidenceKey: "zakazka-parkovani", relationType: "PROGRESS" },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-20",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-bc-parkovani"],
      },
      {
        eventType: "COALITION_MODIFIED",
        eventDate: "2022-11-04",
        title: "Závazek sloučen s programem záchytného parkování",
        evidenceKeys: ["koalice-parkovani"],
      },
      {
        eventType: "BLOCKED",
        eventDate: "2025-05-20",
        title: "Zadávací řízení přerušeno kvůli námitkám",
        evidenceKeys: ["zakazka-parkovani"],
      },
    ],
    coalition: {
      classification: "MERGED",
      reason:
        "Samostatný závazek na tři parkovací domy koaliční smlouva sloučila s programem záchytného parkování do jednoho investičního programu. Počet domů z textu zmizel.",
      evidenceKey: "koalice-parkovani",
    },
  },
  {
    key: "digital",
    listKey: LIST_BC,
    slug: "demo-bc-jednotne-prihlaseni-do-sluzeb-mesta",
    title: "Jednotné přihlášení do digitálních služeb města",
    originalText: QUOTES.programBC_digital,
    normalizedStatement:
      "Do konce roku 2025 zprovoznit jednotné přihlášení pro všechny digitální služby města.",
    topic: "DIGITALIZATION",
    deadlineText: "do konce roku 2025",
    deadlineOn: "2025-12-31",
    primarySource: {
      sourceKey: SOURCE_KEYS.programBC,
      excerpt: QUOTES.programBC_digital,
      pageNumber: 14,
      locator: "kapitola Digitalizace",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 4,
          measurabilityScore: 3,
          deadlineScore: 3,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 3,
        },
        executionStatus: "IN_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Závazek je v koaliční smlouvě. K datu hodnocení nemáme doklad o tom, do kolika služeb je jednotné přihlášení skutečně zavedeno.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [{ evidenceKey: "koalice-digital", relationType: "SUPPORTS" }],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-20",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-bc-digital"],
      },
      {
        eventType: "COALITION_INCLUDED",
        eventDate: "2022-11-04",
        title: "Závazek převzat do koaliční smlouvy",
        evidenceKeys: ["koalice-digital"],
      },
    ],
    coalition: {
      classification: "RETAINED",
      reason:
        "Koaliční smlouva přebírá závazek na jednotný uživatelský účet. Termín v ní není, obsah závazku ano.",
      evidenceKey: "koalice-digital",
    },
  },
  {
    key: "seniori",
    listKey: LIST_BC,
    slug: "demo-bc-300-bytu-pro-seniory",
    title: "300 městských bytů pro seniory",
    originalText: QUOTES.programBC_seniori,
    normalizedStatement:
      "Vyčlenit 300 bytů z městského bytového fondu pro seniory a zveřejnit pravidla pořadníku.",
    topic: "SOCIAL_POLICY",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programBC,
      excerpt: QUOTES.programBC_seniori,
      pageNumber: 19,
      locator: "kapitola Sociální politika",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 5,
          deadlineScore: 3,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 4,
        },
        executionStatus: "PLANNED",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Byty pro seniory mají vzniknout v rámci programu Městský nájemní fond, který je zafinancovaný. Vlastní vyčlenění bytů zatím doložené nemáme.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    // Rozpočtová položka financuje tenhle slib i slib o 2 000 bytech — proto je
    // vazba důkaz ↔ slib M:N (A5).
    evidenceLinks: [
      { evidenceKey: "koalice-seniori", relationType: "SUPPORTS" },
      { evidenceKey: "rozpocet-byty", relationType: "FUNDING" },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-20",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-bc-seniori"],
      },
      {
        eventType: "COALITION_MODIFIED",
        eventDate: "2022-11-04",
        title: "V koaliční smlouvě zůstala obecná podpora bez čísla",
        evidenceKeys: ["koalice-seniori"],
      },
      {
        eventType: "BUDGET_ALLOCATED",
        eventDate: "2023-12-14",
        title: "Financování v rámci programu Městský nájemní fond",
        evidenceKeys: ["rozpocet-byty"],
      },
    ],
    coalition: {
      classification: "MODIFIED",
      reason:
        "Počet 300 bytů ani pořadník se do koaliční smlouvy nedostaly. Zůstal obecný závazek podpory bydlení pro seniory.",
      evidenceKey: "koalice-seniori",
    },
  },
  {
    key: "dluh",
    listKey: LIST_BC,
    slug: "demo-bc-nezvysovani-zadluzeni-mesta",
    title: "Zadlužení města nepřekročí úroveň roku 2022",
    originalText: QUOTES.programBC_dluh,
    normalizedStatement:
      "Udržet celkový dluh města do konce volebního období na úrovni nejvýše 30 miliard korun.",
    topic: "PUBLIC_FINANCE",
    deadlineText: "do konce volebního období",
    deadlineOn: "2026-10-02",
    primarySource: {
      sourceKey: SOURCE_KEYS.programBC,
      excerpt: QUOTES.programBC_dluh,
      pageNumber: 24,
      locator: "kapitola Hospodaření města",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 3,
          measurabilityScore: 4,
          deadlineScore: 3,
          jurisdictionScore: 5,
          outcomeDefinitionScore: 4,
        },
        executionStatus: "ABANDONED",
        outcomeStatus: "NOT_ACHIEVED",
        summary:
          "Zastupitelstvo v září 2025 schválilo emisi dluhopisů a vzalo na vědomí ukončení programu snižování zadluženosti. Dluh k 31. 12. 2025 činil 34,2 mld. Kč oproti slíbeným nejvýše 30 mld. Kč.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    metrics: [
      {
        key: "dluh-celkem",
        name: "Celkový dluh města",
        unit: "mld. Kč",
        direction: "MAINTAIN",
        baselineValue: "30",
        baselineOn: "2022-12-31",
        targetValue: "30",
        targetOn: "2026-10-02",
        definitionNote:
          "Celkový dluh podle výroční zprávy města, tedy včetně emitovaných dluhopisů a přijatých úvěrů. Nezapočítávají se závazky městských firem.",
        sourceKey: SOURCE_KEYS.programBC,
        measurements: [
          {
            value: "34.2",
            measuredOn: "2025-12-31",
            sourceKey: SOURCE_KEYS.zpravaBydleni,
          },
        ],
      },
    ],
    evidenceLinks: [
      {
        evidenceKey: "usneseni-dluh",
        relationType: "CONTRADICTS",
        note: "Zastupitelstvo schválilo emisi dluhopisů a vzalo na vědomí ukončení programu snižování zadluženosti.",
        limitationNote:
          "Usnesení nevypovídá o tom, proč se tak rozhodlo ani jestli šlo o reakci na mimořádné výdaje.",
      },
      { evidenceKey: "zprava-dluh", relationType: "OUTCOME" },
    ],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-20",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-bc-dluh"],
      },
      {
        eventType: "ABANDONED",
        eventDate: "2025-09-09",
        title: "Zastupitelstvo schválilo emisi dluhopisů za 4,2 mld. Kč",
        evidenceKeys: ["usneseni-dluh"],
      },
      {
        eventType: "MILESTONE_REACHED",
        eventDate: "2026-01-31",
        title: "Dluh města dosáhl 34,2 mld. Kč",
        evidenceKeys: ["zprava-dluh"],
      },
    ],
    coalition: {
      classification: "NOT_INCLUDED",
      reason: "Koaliční smlouva neobsahuje žádný závazek k výši zadlužení města.",
    },
  },
  {
    key: "kamery",
    listKey: LIST_D,
    slug: "demo-d-500-novych-kamer",
    title: "Rozšíření kamerového systému o 500 kamer",
    originalText: QUOTES.programD_kamery,
    normalizedStatement:
      "Navýšit počet kamer městského kamerového systému o 500 a napojit je na jednotný dispečink.",
    topic: "SECURITY",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programD,
      excerpt: QUOTES.programD_kamery,
      pageNumber: 5,
      locator: "kapitola Bezpečnost",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 5,
          measurabilityScore: 5,
          deadlineScore: 2,
          jurisdictionScore: 4,
          outcomeDefinitionScore: 2,
        },
        executionStatus: "NO_VERIFIED_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Kandidátka se nestala součástí koalice. K rozhodnému datu jsme nenašli veřejný doklad o kroku, který by k naplnění slibu směřoval. Netvrdíme, že žádný neexistuje.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-18",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-d-kamery"],
      },
    ],
  },
  {
    key: "brownfieldy",
    listKey: LIST_D,
    slug: "demo-d-premena-tri-brownfieldu",
    title: "Přeměna tří brownfieldů na městské čtvrti",
    originalText: QUOTES.programD_brownfieldy,
    normalizedStatement: "Zahájit přeměnu tří brownfieldů na čtvrti se smíšenou funkcí.",
    topic: "URBAN_DEVELOPMENT",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programD,
      excerpt: QUOTES.programD_brownfieldy,
      pageNumber: 11,
      locator: "kapitola Rozvoj města",
    },
    published: true,
    assessments: [
      {
        scores: {
          specificityScore: 4,
          measurabilityScore: 4,
          deadlineScore: 1,
          jurisdictionScore: 4,
          outcomeDefinitionScore: 3,
        },
        executionStatus: "NO_VERIFIED_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        summary:
          "Slib neuvádí, o které brownfieldy jde ani do kdy. K rozhodnému datu jsme nenašli veřejný doklad o zahájení přeměny.",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
    evidenceLinks: [],
    events: [
      {
        eventType: "PROMISE_CREATED",
        eventDate: "2022-08-18",
        title: "Slib zveřejněn ve volebním programu",
        evidenceKeys: ["program-d-brownfieldy"],
      },
    ],
  },
  {
    key: "cyklo",
    listKey: LIST_A,
    slug: "demo-a-chranene-cyklotrasy-v-centru",
    title: "Rozšíření sítě chráněných cyklotras v centru",
    originalText: QUOTES.programA_cyklo,
    normalizedStatement: null,
    topic: "TRANSPORT",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programA,
      excerpt: QUOTES.programA_cyklo,
      pageNumber: 10,
      locator: "kapitola Doprava",
    },
    // Kandidát z AI extrakce. Nepublikovaný, dokud ho neprojde redakce (pravidlo č. 5).
    published: false,
    aiSuggestionKey: "extrakce-cyklo",
  },
  {
    key: "voda",
    listKey: LIST_BC,
    slug: "demo-bc-modernizace-vodohospodarske-infrastruktury",
    title: "Modernizace vodohospodářské infrastruktury",
    originalText: QUOTES.programBC_voda,
    normalizedStatement: null,
    topic: "ENVIRONMENT",
    deadlineText: null,
    deadlineOn: null,
    primarySource: {
      sourceKey: SOURCE_KEYS.programBC,
      excerpt: QUOTES.programBC_voda,
      pageNumber: 28,
      locator: "kapitola Životní prostředí",
    },
    published: false,
  },
];

// ---------------------------------------------------------------------------
// AI běhy a návrhy
// ---------------------------------------------------------------------------

const demoAiRuns: (typeof aiRuns.$inferInsert)[] = [
  {
    id: aiRunId("extrakce-program-a"),
    taskType: "PROMISE_EXTRACTION",
    provider: "fixture",
    model: "fixture-extraction",
    promptVersion: "promise-extraction/2026-08-01",
    sourceDocumentId: sourceId(SOURCE_KEYS.programA),
    inputHash: contentHash(`extraction:${SOURCE_KEYS.programA}`),
    status: "SUCCEEDED",
    startedAt: new Date("2026-02-20T08:00:00.000Z"),
    finishedAt: new Date("2026-02-20T08:01:12.000Z"),
    inputTokens: 61_400,
    outputTokens: 8_120,
    costUsd: "0.000000",
  },
  {
    id: aiRunId("matching-zprava-doprava"),
    taskType: "EVIDENCE_MATCHING",
    provider: "fixture",
    model: "fixture-matching",
    promptVersion: "evidence-matching/2026-08-01",
    sourceDocumentId: sourceId(SOURCE_KEYS.zpravaDoprava),
    inputHash: contentHash(`matching:${SOURCE_KEYS.zpravaDoprava}`),
    status: "SUCCEEDED",
    startedAt: new Date("2026-02-21T08:00:00.000Z"),
    finishedAt: new Date("2026-02-21T08:00:31.000Z"),
    inputTokens: 12_800,
    outputTokens: 940,
    costUsd: "0.000000",
  },
  {
    // Selhaný běh zůstává v datech kvůli opakování a diagnostice.
    id: aiRunId("extrakce-program-d"),
    taskType: "PROMISE_EXTRACTION",
    provider: "fixture",
    model: "fixture-extraction",
    promptVersion: "promise-extraction/2026-08-01",
    sourceDocumentId: sourceId(SOURCE_KEYS.programD),
    inputHash: contentHash(`extraction:${SOURCE_KEYS.programD}`),
    status: "FAILED",
    startedAt: new Date("2026-02-22T08:00:00.000Z"),
    finishedAt: new Date("2026-02-22T08:00:04.000Z"),
    error: "Odpověď modelu neprošla validací schématu: chybí pole sourceExcerpt.",
  },
];

const demoAiSuggestions: (typeof aiSuggestions.$inferInsert)[] = [
  {
    id: aiSuggestionId("extrakce-cyklo"),
    aiRunId: aiRunId("extrakce-program-a"),
    payload: {
      originalText: QUOTES.programA_cyklo,
      suggestedTitle: "Rozšíření sítě chráněných cyklotras v centru",
      topic: "TRANSPORT",
      specificityScore: 2,
      measurabilityScore: 1,
      deadlineScore: 0,
      jurisdictionScore: 4,
      outcomeDefinitionScore: 1,
      reasoningSummary:
        "Věta neuvádí rozsah ani termín. Bez doplnění z jiného zdroje nejde určit, co by znamenalo splnění.",
      sourceExcerpt: QUOTES.programA_cyklo,
    },
    confidence: "0.720",
    status: "ACCEPTED",
    reviewedById: USER_EDITOR,
    reviewedAt: new Date("2026-02-25T11:00:00.000Z"),
    reviewNote: "Kandidát převzat, hodnocení zatím nevzniklo.",
  },
  {
    id: aiSuggestionId("matching-tramvaj"),
    aiRunId: aiRunId("matching-zprava-doprava"),
    payload: {
      promiseSlug: "demo-a-tramvajova-trat-do-demo-ctvrti",
      relationType: "PROGRESS",
      excerpt: QUOTES.zprava_doprava,
      confidence: 0.64,
      explanation:
        "Zpráva zmiňuje tramvajovou trať do Demo čtvrti a datum zahájení stavby, což odpovídá znění slibu.",
    },
    confidence: "0.640",
    status: "PENDING",
  },
];

// ---------------------------------------------------------------------------
// Odvozené tabulky
// ---------------------------------------------------------------------------

const demoPromises: (typeof promises.$inferInsert)[] = DEMO_PROMISES.map((promise) => ({
  id: promiseId(promise.key),
  electoralListId: listId(promise.listKey),
  slug: promise.slug,
  title: promise.title,
  originalText: promise.originalText,
  normalizedStatement: promise.normalizedStatement,
  topic: promise.topic,
  deadlineText: promise.deadlineText,
  deadlineOn: promise.deadlineOn,
  published: promise.published,
  publishedAt: promise.published ? PUBLISHED_AT : null,
  aiSuggestionId: promise.aiSuggestionKey ? aiSuggestionId(promise.aiSuggestionKey) : null,
}));

const demoPromiseSources: (typeof promiseSources.$inferInsert)[] = DEMO_PROMISES.map((promise) => ({
  id: seedId(`promise-source:${promise.key}`),
  promiseId: promiseId(promise.key),
  sourceDocumentId: sourceId(promise.primarySource.sourceKey),
  excerpt: promise.primarySource.excerpt,
  pageNumber: promise.primarySource.pageNumber ?? null,
  locator: promise.primarySource.locator ?? null,
  isPrimary: true,
}));

const demoPromiseMetrics: (typeof promiseMetrics.$inferInsert)[] = DEMO_PROMISES.flatMap(
  (promise) =>
    (promise.metrics ?? []).map((metric) => ({
      id: metricId(metric.key),
      promiseId: promiseId(promise.key),
      name: metric.name,
      unit: metric.unit,
      direction: metric.direction,
      baselineValue: metric.baselineValue,
      baselineOn: metric.baselineOn,
      targetValue: metric.targetValue,
      targetOn: metric.targetOn,
      definitionNote: metric.definitionNote,
      sourceDocumentId: metric.sourceKey ? sourceId(metric.sourceKey) : null,
    })),
);

const demoMetricMeasurements: (typeof metricMeasurements.$inferInsert)[] = DEMO_PROMISES.flatMap(
  (promise) =>
    (promise.metrics ?? []).flatMap((metric) =>
      metric.measurements.map((measurement) => ({
        id: seedId(`measurement:${metric.key}:${measurement.measuredOn}`),
        metricId: metricId(metric.key),
        value: measurement.value,
        measuredOn: measurement.measuredOn,
        sourceDocumentId: sourceId(measurement.sourceKey),
        note: measurement.note ?? null,
      })),
    ),
);

const demoPromiseEvents: (typeof promiseEvents.$inferInsert)[] = DEMO_PROMISES.flatMap((promise) =>
  (promise.events ?? []).map((event, index) => ({
    id: seedId(`event:${promise.key}:${index}`),
    promiseId: promiseId(promise.key),
    eventType: event.eventType,
    eventDate: event.eventDate,
    title: event.title,
    description: event.description ?? null,
  })),
);

const demoPromiseEventEvidence: (typeof promiseEventEvidence.$inferInsert)[] =
  DEMO_PROMISES.flatMap((promise) =>
    (promise.events ?? []).flatMap((event, index) =>
      event.evidenceKeys.map((key) => ({
        eventId: seedId(`event:${promise.key}:${index}`),
        evidenceId: evidenceId(key),
      })),
    ),
  );

const demoPromiseEvidence: (typeof promiseEvidence.$inferInsert)[] = DEMO_PROMISES.flatMap(
  (promise) =>
    (promise.evidenceLinks ?? []).map((link) => {
      const humanVerified = link.humanVerified ?? true;
      return {
        id: seedId(`promise-evidence:${promise.key}:${link.evidenceKey}:${link.relationType}`),
        promiseId: promiseId(promise.key),
        evidenceId: evidenceId(link.evidenceKey),
        relationType: link.relationType,
        confidence: link.confidence ?? null,
        note: link.note ?? null,
        limitationNote: link.limitationNote ?? null,
        humanVerified,
        verifiedById: humanVerified ? USER_REVIEWER : null,
        verifiedAt: humanVerified ? REVIEWED_AT : null,
        aiSuggestionId: link.aiSuggestionKey ? aiSuggestionId(link.aiSuggestionKey) : null,
      };
    }),
);

/**
 * Návrh AI, který ještě nikdo nepotvrdil. Existuje v datech, ale veřejné
 * stránky ho zobrazit nesmí — dokud `human_verified` není true, je to hypotéza,
 * ne doložený fakt (integritní pravidlo č. 2 a 7).
 */
demoPromiseEvidence.push({
  id: seedId("promise-evidence:tramvaj:zprava-doprava:ai"),
  promiseId: promiseId("tramvaj"),
  evidenceId: evidenceId("zprava-doprava"),
  relationType: "SUPPORTS",
  confidence: "0.640",
  humanVerified: false,
  aiSuggestionId: aiSuggestionId("matching-tramvaj"),
  note: "Návrh z evidence matchingu, čeká na redakční ověření.",
});

const demoAssessments: (typeof promiseAssessments.$inferInsert)[] = DEMO_PROMISES.flatMap(
  (promise) => {
    const versions = promise.assessments ?? [];

    return versions.map((version, index) => {
      const derived = deriveAssessability(version.scores);
      const versionNumber = index + 1;
      const isLatest = index === versions.length - 1;

      return {
        id: assessmentId(promise.key, versionNumber),
        promiseId: promiseId(promise.key),
        version: versionNumber,
        previousAssessmentId: index === 0 ? null : assessmentId(promise.key, versionNumber - 1),
        ...version.scores,
        assessability: derived.level,
        methodologyVersion: derived.methodologyVersion,
        // Ukázkový dataset představuje hotovou redakční práci, ne rozdělanou.
        workflowState: "PUBLISHED" as const,
        sourcesReviewedUpTo: version.sourcesReviewedUpTo ?? version.createdAt.slice(0, 10),
        executionStatus: version.executionStatus,
        outcomeStatus: version.outcomeStatus,
        summary: version.summary,
        changeReason: version.changeReason ?? null,
        createdById: USER_EDITOR,
        reviewedById: USER_REVIEWER,
        reviewedAt: new Date(version.createdAt),
        isCurrent: isLatest,
        createdAt: new Date(version.createdAt),
      };
    });
  },
);

const demoCoalitionMappings: (typeof coalitionPromiseMappings.$inferInsert)[] =
  DEMO_PROMISES.flatMap((promise) => {
    if (!promise.coalition) return [];

    return [
      {
        id: seedId(`coalition-mapping:${promise.key}`),
        promiseId: promiseId(promise.key),
        coalitionSourceDocumentId: sourceId(SOURCE_KEYS.koalicniSmlouva),
        classification: promise.coalition.classification,
        coalitionEvidenceId: promise.coalition.evidenceKey
          ? evidenceId(promise.coalition.evidenceKey)
          : null,
        reason: promise.coalition.reason,
        humanVerified: true,
        verifiedById: USER_REVIEWER,
        verifiedAt: REVIEWED_AT,
      },
    ];
  });

const demoCorrections: (typeof corrections.$inferInsert)[] = [
  {
    id: seedId("correction:byty-mereni"),
    promiseId: promiseId("byty"),
    kind: "PUBLIC_CORRECTION",
    status: "APPLIED",
    submitterName: "Demo čtenář",
    body: "V hodnocení chybí čísla ze zprávy o bytovém fondu za rok 2025, která už město zveřejnilo.",
    response:
      "Podnět byl oprávněný. Doplnili jsme naměřenou hodnotu 910 bytů a vydali novou verzi hodnocení.",
    appliedAssessmentId: assessmentId("byty", 2),
    handledById: USER_REVIEWER,
    resolvedAt: new Date("2026-06-20T09:30:00.000Z"),
  },
  {
    id: seedId("correction:dluh-reakce"),
    promiseId: promiseId("dluh"),
    kind: "PARTY_RESPONSE",
    status: "ACKNOWLEDGED",
    submitterName: "Demo osoba B1",
    submitterOrganization: "Demo koalice B+C",
    body: "Emise dluhopisů reagovala na mimořádné výdaje, o kterých se v roce 2022 nevědělo. Považujeme za nepřesné mluvit o opuštění závazku.",
    handledById: USER_REVIEWER,
  },
];

const demoReviewDecisions: (typeof reviewDecisions.$inferInsert)[] = [
  ...DEMO_PROMISES.filter((promise) => promise.published).map((promise) => ({
    id: seedId(`review-decision:publish:${promise.key}`),
    reviewerId: USER_REVIEWER,
    entityType: "promise",
    entityId: promiseId(promise.key),
    decision: "PUBLISH" as const,
    note: "Hodnocení zkontrolováno, každý výrok má oporu ve zdroji.",
    createdAt: PUBLISHED_AT,
  })),
  {
    id: seedId("review-decision:accept:extrakce-cyklo"),
    reviewerId: USER_EDITOR,
    entityType: "ai_suggestion",
    entityId: aiSuggestionId("extrakce-cyklo"),
    decision: "ACCEPT",
    note: "Kandidát převzat do fronty ke zpracování.",
    createdAt: new Date("2026-02-25T11:00:00.000Z"),
  },
];

const demoAuditLogs: (typeof auditLogs.$inferInsert)[] = [
  {
    id: seedId("audit:byty-publish"),
    actorId: USER_REVIEWER,
    action: "promise.publish",
    entityType: "promise",
    entityId: promiseId("byty"),
    afterJson: { published: true },
    createdAt: PUBLISHED_AT,
  },
  {
    id: seedId("audit:byty-assessment-v2"),
    actorId: USER_EDITOR,
    action: "assessment.create",
    entityType: "promise_assessment",
    entityId: assessmentId("byty", 2),
    beforeJson: { executionStatus: "IN_PROGRESS", outcomeStatus: "NOT_MEASURABLE_YET" },
    afterJson: { executionStatus: "PARTIALLY_COMPLETED", outcomeStatus: "PARTIALLY_ACHIEVED" },
    createdAt: new Date("2026-06-20T09:30:00.000Z"),
  },
];

// ---------------------------------------------------------------------------

export interface DemoDataset {
  appUsers: (typeof appUsers.$inferInsert)[];
  jurisdictions: (typeof jurisdictions.$inferInsert)[];
  elections: (typeof elections.$inferInsert)[];
  parties: (typeof parties.$inferInsert)[];
  sourceDocuments: (typeof sourceDocuments.$inferInsert)[];
  partyLineage: (typeof partyLineage.$inferInsert)[];
  electoralLists: (typeof electoralLists.$inferInsert)[];
  electoralListParties: (typeof electoralListParties.$inferInsert)[];
  persons: (typeof persons.$inferInsert)[];
  personRoles: (typeof personRoles.$inferInsert)[];
  aiRuns: (typeof aiRuns.$inferInsert)[];
  aiSuggestions: (typeof aiSuggestions.$inferInsert)[];
  promises: (typeof promises.$inferInsert)[];
  promiseSources: (typeof promiseSources.$inferInsert)[];
  promiseMetrics: (typeof promiseMetrics.$inferInsert)[];
  metricMeasurements: (typeof metricMeasurements.$inferInsert)[];
  promiseEvents: (typeof promiseEvents.$inferInsert)[];
  evidence: (typeof evidenceTable.$inferInsert)[];
  promiseEvidence: (typeof promiseEvidence.$inferInsert)[];
  promiseEventEvidence: (typeof promiseEventEvidence.$inferInsert)[];
  promiseAssessments: (typeof promiseAssessments.$inferInsert)[];
  coalitionPromiseMappings: (typeof coalitionPromiseMappings.$inferInsert)[];
  corrections: (typeof corrections.$inferInsert)[];
  reviewDecisions: (typeof reviewDecisions.$inferInsert)[];
  auditLogs: (typeof auditLogs.$inferInsert)[];
}

export const DEMO_DATASET: DemoDataset = {
  appUsers: demoUsers,
  jurisdictions: demoJurisdictions,
  elections: demoElections,
  parties: demoParties,
  sourceDocuments: DEMO_SOURCE_DOCUMENTS,
  partyLineage: demoPartyLineage,
  electoralLists: demoElectoralLists,
  electoralListParties: demoElectoralListParties,
  persons: demoPersons,
  personRoles: demoPersonRoles,
  aiRuns: demoAiRuns,
  aiSuggestions: demoAiSuggestions,
  promises: demoPromises,
  promiseSources: demoPromiseSources,
  promiseMetrics: demoPromiseMetrics,
  metricMeasurements: demoMetricMeasurements,
  promiseEvents: demoPromiseEvents,
  evidence: demoEvidence,
  promiseEvidence: demoPromiseEvidence,
  promiseEventEvidence: demoPromiseEventEvidence,
  promiseAssessments: demoAssessments,
  coalitionPromiseMappings: demoCoalitionMappings,
  corrections: demoCorrections,
  reviewDecisions: demoReviewDecisions,
  auditLogs: demoAuditLogs,
};

/** Klíč koaliční smlouvy, proti které se v demu porovnává. Používá /compare. */
export const DEMO_COALITION_AGREEMENT_ID = sourceId(SOURCE_KEYS.koalicniSmlouva);
