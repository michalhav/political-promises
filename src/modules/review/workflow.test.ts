import { describe, expect, it } from "vitest";

import {
  availableActions,
  checkTransition,
  isEditableState,
  nextState,
} from "@/modules/review/workflow";

const AUTHOR = "autor";
const OTHER = "nekdo-jiny";

describe("přechody workflow", () => {
  it("autor předá rozpracované i vrácené hodnocení k revizi", () => {
    expect(
      checkTransition("SUBMIT", { currentState: "DRAFT", authorId: AUTHOR, actorId: AUTHOR }),
    ).toBeNull();
    expect(
      checkTransition("SUBMIT", {
        currentState: "CHANGES_REQUESTED",
        authorId: AUTHOR,
        actorId: AUTHOR,
      }),
    ).toBeNull();
  });

  it("schválit ani vrátit nemůže autor sám sobě", () => {
    expect(
      checkTransition("APPROVE", { currentState: "IN_REVIEW", authorId: AUTHOR, actorId: AUTHOR }),
    ).toContain("vlastní autor");
    expect(
      checkTransition("REQUEST_CHANGES", {
        currentState: "IN_REVIEW",
        authorId: AUTHOR,
        actorId: AUTHOR,
      }),
    ).toContain("vlastní autor");
  });

  it("někdo jiný schválit může", () => {
    expect(
      checkTransition("APPROVE", { currentState: "IN_REVIEW", authorId: AUTHOR, actorId: OTHER }),
    ).toBeNull();
  });

  it("publikovat lze jen schválené hodnocení", () => {
    expect(
      checkTransition("PUBLISH", { currentState: "APPROVED", authorId: AUTHOR, actorId: OTHER }),
    ).toBeNull();
    expect(
      checkTransition("PUBLISH", { currentState: "DRAFT", authorId: AUTHOR, actorId: OTHER }),
    ).toContain("nelze provést");
    expect(
      checkTransition("PUBLISH", { currentState: "IN_REVIEW", authorId: AUTHOR, actorId: OTHER }),
    ).toContain("nelze provést");
  });

  it("z publikovaného stavu už nikam nevede cesta", () => {
    const context = { currentState: "PUBLISHED" as const, authorId: AUTHOR, actorId: OTHER };
    expect(availableActions(context)).toEqual([]);
  });

  it("upravovat obsah lze jen v rozpracovaném nebo vráceném stavu", () => {
    expect(isEditableState("DRAFT")).toBe(true);
    expect(isEditableState("CHANGES_REQUESTED")).toBe(true);
    // V revizi by se text měnil recenzentovi pod rukama, po schválení by šlo
    // schválené znění nepozorovaně vyměnit.
    expect(isEditableState("IN_REVIEW")).toBe(false);
    expect(isEditableState("APPROVED")).toBe(false);
    expect(isEditableState("PUBLISHED")).toBe(false);
  });

  it("cílové stavy odpovídají akcím", () => {
    expect(nextState("SUBMIT")).toBe("IN_REVIEW");
    expect(nextState("REQUEST_CHANGES")).toBe("CHANGES_REQUESTED");
    expect(nextState("APPROVE")).toBe("APPROVED");
    expect(nextState("PUBLISH")).toBe("PUBLISHED");
  });

  it("autorovi v revizi nenabídne nic, recenzentovi obojí", () => {
    expect(
      availableActions({ currentState: "IN_REVIEW", authorId: AUTHOR, actorId: AUTHOR }),
    ).toEqual([]);
    expect(
      availableActions({ currentState: "IN_REVIEW", authorId: AUTHOR, actorId: OTHER }),
    ).toEqual(["REQUEST_CHANGES", "APPROVE"]);
  });
});
