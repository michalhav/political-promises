/**
 * Zlatý dataset — ručně anotovaná pravda o jednom dokumentu.
 *
 * Vzniká **před** extraktorem, ne po něm. Kdyby se anotovalo až podle toho, co
 * stroj vytáhl, měřili bychom, jestli dělá to, co dělá.
 *
 * Dataset obsahuje obojí:
 *  - `PROMISE` — věta, kterou má extraktor najít,
 *  - `NOT_PROMISE` — věta, která slib **není**, ale svádí k tomu.
 *
 * Negativní příklady jsou stejně důležité. Bez nich by extraktor, který označí
 * půlku dokumentu, vypadal skvěle na úplnosti a jeho přesnost by nebylo s čím
 * poměřit — a zaplavená redakční fronta je horší než chybějící kandidát.
 *
 * Rozsahy míří do **kanonického** textu konkrétní verze dokumentu. Proto se
 * ukládá otisk souboru i verze extraktoru: po jejich změně je potřeba anotace
 * ověřit znovu, protože posuny už nemusí sedět.
 */
import { z } from "zod";

import { topicEnum } from "@/db/enums";
import { getPage, sliceSpan, type CanonicalDocument } from "@/modules/ingestion/canonical";

export const GOLDEN_DATASET_VERSION = "1";

export const goldenExampleSchema = z.object({
  /** Stabilní identifikátor, aby šlo o konkrétním příkladu mluvit. */
  id: z.string().trim().min(1).max(120),
  label: z.enum(["PROMISE", "NOT_PROMISE"]),
  page: z.number().int().min(1),
  span: z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  }),
  /** Doslovný text. Musí přesně odpovídat rozsahu — kontroluje se při načtení. */
  quote: z.string().min(1),
  normalizedStatement: z.string().trim().min(1).optional(),
  topic: z.enum(topicEnum.enumValues).optional(),
  /** Proč to anotátor rozhodl takhle. U sporných případů povinné v praxi, ne schématem. */
  notes: z.string().trim().optional(),
  annotator: z.string().trim().min(1).max(120),
  annotatedOn: z.iso.date(),
});

export type GoldenExample = z.infer<typeof goldenExampleSchema>;

export const goldenDatasetSchema = z.object({
  datasetVersion: z.literal(GOLDEN_DATASET_VERSION),
  /** Verze anotačních pokynů, podle kterých se rozhodovalo. */
  guidelinesVersion: z.string().trim().min(1),
  document: z.object({
    sourceName: z.string().trim().min(1),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    extractorVersion: z.string().trim().min(1),
  }),
  /**
   * Verze zpracovací reprezentace, nad kterou anotace vznikly. Rozsahy míří do
   * kanonického textu, ale nabídka úseků závisí i na tom, co se vyloučilo jako
   * stránková výbava — bez téhle informace by nešlo anotace zpětně zopakovat.
   */
  processingVersion: z.string().trim().min(1).optional(),
  examples: z.array(goldenExampleSchema),
});

export type GoldenDataset = z.infer<typeof goldenDatasetSchema>;

export function parseGoldenDataset(raw: unknown): GoldenDataset {
  return goldenDatasetSchema.parse(raw);
}

export interface DatasetIssue {
  exampleId: string | null;
  severity: "ERROR" | "WARNING";
  message: string;
}

/**
 * Ověří, že dataset sedí na dokument.
 *
 * Nejdůležitější kontrola je poslední: citace musí znak po znaku odpovídat
 * tomu, co na daném místě stránky doopravdy stojí. Bez ní by se zlatý dataset
 * mohl nepozorovaně rozejít s dokumentem a všechna čísla z evaluace by měřila
 * něco jiného, než si myslíme.
 */
export function validateGoldenDataset(
  dataset: GoldenDataset,
  document: CanonicalDocument,
): DatasetIssue[] {
  const issues: DatasetIssue[] = [];

  if (dataset.document.contentHash !== document.contentHash) {
    issues.push({
      exampleId: null,
      severity: "ERROR",
      message:
        "Otisk dokumentu v datasetu neodpovídá dodanému dokumentu. Anotace patří k jinému souboru.",
    });
  }

  if (dataset.document.extractorVersion !== document.extractorVersion) {
    issues.push({
      exampleId: null,
      severity: "WARNING",
      message: `Dataset byl anotovaný nad extrakcí ${dataset.document.extractorVersion}, dokument je z ${document.extractorVersion}. Posuny nemusí sedět.`,
    });
  }

  const seenIds = new Set<string>();

  for (const example of dataset.examples) {
    if (seenIds.has(example.id)) {
      issues.push({
        exampleId: example.id,
        severity: "ERROR",
        message: "Duplicitní identifikátor příkladu.",
      });
    }
    seenIds.add(example.id);

    if (example.span.end <= example.span.start) {
      issues.push({
        exampleId: example.id,
        severity: "ERROR",
        message: "Rozsah končí dřív, než začíná.",
      });
      continue;
    }

    const page = getPage(document, example.page);
    if (!page) {
      issues.push({
        exampleId: example.id,
        severity: "ERROR",
        message: `Dokument nemá stránku ${example.page}.`,
      });
      continue;
    }

    const actual = sliceSpan(document, { page: example.page, ...example.span });
    if (actual === null) {
      issues.push({
        exampleId: example.id,
        severity: "ERROR",
        message: `Rozsah ${example.span.start}–${example.span.end} je mimo text stránky ${example.page} (délka ${page.text.length}).`,
      });
      continue;
    }

    if (actual !== example.quote) {
      issues.push({
        exampleId: example.id,
        severity: "ERROR",
        message: `Citace neodpovídá textu na daném místě. V dokumentu stojí: „${actual}".`,
      });
    }
  }

  return issues;
}

export function promiseExamples(dataset: GoldenDataset): GoldenExample[] {
  return dataset.examples.filter((example) => example.label === "PROMISE");
}

export function notPromiseExamples(dataset: GoldenDataset): GoldenExample[] {
  return dataset.examples.filter((example) => example.label === "NOT_PROMISE");
}
