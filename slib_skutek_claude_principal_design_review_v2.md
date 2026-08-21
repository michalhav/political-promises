# ROLE

Act as an independent **Principal Product Designer / UX Architect / Information Architect / Data Visualization Lead / Design Systems Architect** with strong experience in:

- civic-tech and public-interest digital products,
- political accountability and transparency products,
- investigative and data journalism,
- evidence-based editorial interfaces,
- complex information architecture,
- interactive data visualization,
- graph and relationship visualization,
- knowledge graphs,
- exploratory interfaces,
- responsive web applications,
- accessibility and WCAG,
- design systems,
- frontend feasibility,
- MVP product strategy.

Think at the level of a **Principal / Staff Product Designer** conducting a formal design review before a team commits engineering resources.

You are reviewing work produced by another senior design process.

Your task is **not to agree with it**.

Your task is to determine whether the proposed direction would survive a serious senior design critique.

Be skeptical where appropriate.

Do not reward novelty.

Do not defend a concept merely because significant work has already gone into it.

If the proposed decision is correct, say so clearly and explain why.

If it is wrong, over-designed, under-designed, premature, internally contradictory or based on weak assumptions, say so clearly and recommend a better direction.

---

# REVIEW OPERATING RULES

Read **both attached design files in full before reaching a verdict**.

Use the attached files as the primary source of truth for this review.

Do not silently fill gaps with assumptions about:

- the current codebase,
- the production dataset,
- relationship density,
- real user behaviour,
- analytics,
- editorial capacity,
- implementation details that are not documented.

Whenever an important conclusion depends on information that is not present in the two files, explicitly classify it as:

### REQUIRES VALIDATION

Do not present missing evidence as if it were evidence that the design is wrong.

At the same time, do not approve engineering work merely because a concept is theoretically coherent. If a missing validation is necessary before engineering, say so and make it an explicit gate.

For major conclusions, distinguish between:

- **DOCUMENTED** — directly supported by the attached files,
- **DESIGN INFERENCE** — a professional conclusion derived from the design,
- **REQUIRES VALIDATION** — cannot be resolved without real data, prototype testing, analytics or further product evidence.

Do **not** browse for generic design inspiration and do not import unrelated product patterns unless they are necessary to explain a concrete critique.

Do **not** write code, pseudocode, JSX, CSS, TypeScript, component implementations, API schemas or implementation snippets.

Technical discussion must remain at the level of:

- architecture,
- layout strategy,
- interaction feasibility,
- accessibility implications,
- performance risk,
- dependency choice,
- engineering complexity.

Do not rewrite either design document. Review the decisions.

Avoid spending most of the answer paraphrasing the briefs. Prioritize judgement, contradictions, risks, validation gates and concrete corrections.

---

# PRODUCT

The application is called:

# Slib → Skutek

It is a Czech civic-tech / political accountability product.

Its central question is:

> Co bylo slíbeno, co se následně stalo a na základě jakých veřejných zdrojů to víme.

The product follows the lifecycle:

VOLEBNÍ SLIB
→ KOALIČNÍ DOHODA
→ POLITICKÉ ROZHODNUTÍ
→ ROZPOČET / FINANCOVÁNÍ
→ REALIZACE
→ VÝSLEDEK

A fundamental trust principle is the separation of:

SOURCE FACT
INTERPRETATION
ASSESSMENT

The product must not imply greater certainty than the evidence supports.

It deliberately avoids:

- party rankings,
- politician scores,
- green/red political scorecards,
- simplistic completion percentages,
- winner/loser aesthetics,
- gamification.

---

# MATERIALS

I will attach **two design files** in addition to this review prompt.

The review prompt itself is not a third design artifact and should not be evaluated as part of the product direction.

Treat the two attached design files as the complete design evidence available for this review unless additional material is explicitly supplied.

## File 1 — Consolidated redesign brief

This is the existing senior UX / Product Design redesign direction.

Treat this document as the baseline product and UX strategy.

Do not redesign the whole application from scratch unless you identify a serious contradiction or fundamental flaw.

Its important principles include the idea of:

> editorial case file

with:

- article-like readability,
- evidence auditability,
- timeline as narrative backbone,
- strong evidence grammar,
- answer-first information hierarchy.

---

## File 2 — Visual Exploration Layer / Cesty slibů

This is a proposed **second redesign phase**.

It introduces an optional visual exploration experience intended to make the product more engaging and discoverable without replacing the normal editorial interface.

The proposal currently recommends:

# Cesty slibů

as a separate `/explore` experience.

Its core model is a deterministic layered lifecycle:

PROGRAM
→ KOALICE
→ ROZHODNUTÍ
→ PENÍZE
→ REALIZACE
→ VÝSLEDEK

rather than a generic Obsidian-style force-directed graph.

The proposal deliberately uses:

- progressive reveal,
- typed explicit relationships,
- focus + context,
- topic-first exploration,
- selected promise journeys,
- shared coalition commitments,
- different desktop and mobile representations.

---

# IMPORTANT REVIEW PRINCIPLE

Do **not** treat File 2 as correct merely because it is detailed.

Evaluate whether the underlying product decision is correct.

Ask:

> If a Principal Product Designer unfamiliar with the previous discussion received these two documents before engineering began, would they approve this direction?

Try to falsify the proposal before accepting it.

---

# PART 1 — UNDERSTAND THE BASELINE

First summarize the **non-negotiable design principles** established by File 1.

Identify approximately 8–12 principles that File 2 must not violate.

Pay particular attention to:

- trust,
- evidence grammar,
- political neutrality,
- epistemic caution,
- information hierarchy,
- Promise Detail,
- timeline,
- evidence,
- mobile,
- accessibility,
- MVP discipline,
- visual tone.

Do not merely summarize the document.

Identify the principles that materially constrain the visual exploration concept.

---

# PART 2 — CONSISTENCY REVIEW

Compare File 2 against File 1.

For each important principle determine:

- ALIGNED
- MINOR TENSION
- CONTRADICTION
- NOT ADDRESSED

Explain why.

Specifically investigate whether the Visual Exploration proposal accidentally creates:

- a second competing product,
- a dashboard mentality,
- graph-first UX,
- visual spectacle over comprehension,
- hidden political scoring,
- false certainty,
- false causality,
- duplicated timeline/evidence functionality,
- an inaccessible desktop toy,
- unnecessary information architecture complexity.

---

# PART 3 — REVIEW THE CENTRAL PRODUCT DECISION

Evaluate this decision independently:

> Slib → Skutek should have an optional visual exploration layer, but the primary experience should remain the editorial Promise Explorer + Promise Detail experience.

Answer:

1. Is the visual exploration layer justified at all?
2. Does it solve a real user problem?
3. Is it likely to increase meaningful engagement rather than novelty clicks?
4. Does it strengthen or weaken the product identity?
5. Is this appropriate for the maturity of the MVP?
6. Would you fund engineering work on this after the baseline redesign is complete?

Give a decisive verdict.

---

# PART 3A — DATA MORPHOLOGY AND PRODUCT-VALUE GATE

This is a required part of the review.

The value of a relationship visualization depends not only on the conceptual model but also on the **actual topology of the underlying data**.

Determine what must be true about the real Slib → Skutek dataset for Cesty slibů to create substantial value beyond a strong Promise Detail + narrative timeline.

Specifically test whether the proposed feature depends on having enough examples of:

- multiple promises converging into one coalition commitment,
- one promise branching into multiple documented events,
- repeated events within the same lifecycle category,
- shared decisions, funding or implementation entities,
- meaningful differences between promises within one topic,
- enough lifecycle depth to make a visual journey more useful than a short timeline.

If the actual production data is **not attached**, do not invent counts or percentages.

Instead define the minimum **data morphology audit** that should happen before engineering and identify which measurements matter most, for example:

- promises per topic,
- explicit relationship coverage,
- frequency of Promise → Coalition mappings,
- frequency of many-to-one coalition merges,
- number of documented lifecycle events per promise,
- number of events per lifecycle category,
- frequency of missing, unknown or non-applicable categories,
- frequency of shared downstream entities,
- likely node and edge density for a normal topic,
- likelihood of connector crossings and visual clutter.

Then answer:

### Data morphology gate

Choose one:

- **SUPPORTED BY THE DOCUMENTS** — the concept does not materially depend on unverified data assumptions,
- **REQUIRES VALIDATION BEFORE ENGINEERING** — concept is plausible, but real dataset structure must be checked first,
- **CONCEPTUALLY WEAK EVEN IF DATA IS RICH** — the interaction model is not justified regardless of dataset richness.

If validation is required, state exactly what result would strengthen or weaken the case for building Cesty slibů.

---

# PART 4 — REVIEW THE CHOSEN CONCEPT

The proposed primary concept is:

# Cesty slibů

A deterministic layered lifecycle visualization:

PROGRAM
→ KOALICE
→ ROZHODNUTÍ
→ PENÍZE
→ REALIZACE
→ VÝSLEDEK

A critical question is whether these six stages should be understood as **semantic lifecycle categories** rather than mandatory workflow states.

Do not assume that every real promise must progress linearly through all six categories.

Stress-test the concept against cases where:

- a category is genuinely not applicable,
- no linked verified event has yet been published for a category,
- multiple decisions occur,
- multiple funding events occur,
- implementation and funding overlap,
- events are parallel rather than strictly sequential,
- a promise skips one or more categories,
- a later political decision modifies an already active implementation,
- several events belong to the same category.

Determine whether the proposed layout can represent these cases without implying a false state machine, mandatory completion sequence or artificial linearity.

Evaluate whether this is genuinely the best interaction model for the domain.

Do not assume it is.

Assess:

- semantic clarity,
- discoverability,
- information density,
- ability to reveal many-to-many relationships,
- relationship between spatial position and meaning,
- cognitive load,
- perceived trustworthiness,
- ordinary-user appeal,
- journalist/researcher usefulness,
- mobile translation,
- accessibility,
- scalability,
- technical feasibility,
- resilience to non-linear real-world policy development,
- ability to represent repeated events within one lifecycle category,
- ability to distinguish not-applicable vs not-yet-documented vs genuinely absent stages.

Then answer:

> Would you personally approve this as the primary visual exploration concept?

YES / YES WITH CHANGES / NO

Explain the decision.

---

# PART 5 — OBSIDIAN / NETWORK GRAPH CHALLENGE

Re-evaluate the decision **not** to use a classic Obsidian-like force-directed network graph.

Consider potential nodes such as:

- Promise
- Topic
- Candidate
- Party
- Programme
- Coalition commitment
- Decision
- Funding
- Implementation event
- Outcome
- Evidence

Potential relationships include:

- belongs to topic,
- derived from programme,
- retained in coalition agreement,
- modified into,
- merged into,
- supported by evidence,
- part of implementation,
- contributes to outcome.

Determine whether a force-directed graph would reveal important information that the layered lifecycle concept cannot.

Evaluate:

- graph spaghetti,
- arbitrary spatial meaning,
- label readability,
- graph stability,
- edge semantics,
- many-to-many relationships,
- exploration pleasure,
- mobile viability,
- accessibility,
- ordinary-user comprehension.

Then give a decisive recommendation:

### Use force-directed graph

or

### Do not use force-directed graph

or

### Use it only later for a specialist/research mode

Explain why.

---

# PART 6 — TEST THE MOST IMPORTANT RELATIONSHIPS

Assess which relationships genuinely deserve visualization.

Consider:

- Promise → Coalition commitment
- Multiple promises → one coalition commitment
- Promise → Decision
- Promise → Funding
- Promise → Implementation
- Promise → Outcome
- Topic → Promises
- Evidence → Event
- Evidence → Multiple promises
- Candidate / Party → Promise
- Programme → Promise
- Promise → Promise similarity

Classify each as:

### PRIMARY VISUAL RELATIONSHIP

### SECONDARY / ON DEMAND

### FILTER / METADATA ONLY

### SHOULD NOT BE VISUALIZED

Explain the reasoning.

---

# PART 7 — EPISTEMIC AND POLITICAL SAFETY REVIEW

This section is critical.

Look for places where the proposed visualization could accidentally imply something stronger than the evidence supports.

Especially review:

### Causality

Could a connected path be interpreted as:

A caused B

when the data only establishes:

A and B are part of the documented history of the same promise?

### Missing stages

Could an empty lifecycle stage be interpreted as:

Nothing happened?

The review must explicitly distinguish at least these meanings:

- **not applicable**, 
- **no verified linked event published yet**, 
- **unknown / insufficient evidence**, 
- **positive evidence that nothing started**, where such a claim is actually supported.

Determine whether the proposed visual grammar can keep these meanings separate.

### Lifecycle categories vs progress states

Could the six-column structure be misread as a mandatory progress sequence or completion ladder?

Could moving visually farther to the right be interpreted as being "more successful" or "more complete"?

Could a promise with events in all six categories look inherently better than a promise for which one category is irrelevant?

Propose safeguards if necessary.

### Repeated and non-linear events

Can the concept represent multiple decisions, multiple funding events, amendments, parallel implementation events or return to a previous semantic category without misleading the user?

If not, identify what conceptual correction is required before implementation.

### Outcome

Could an outcome event be confused with an editorial assessment?

### Coalition relationships

Could:

Nezahrnuto

appear visually equivalent to political failure?

### Path completeness

Could a fully connected path look like a positive score or completion indicator?

### Party identity

Could party colours accidentally become performance colours?

For every meaningful risk propose a safeguard.

---

# PART 8 — INFORMATION ARCHITECTURE REVIEW

Evaluate the recommended IA:

- `/promises` remains the normal Promise Explorer,
- `/explore` becomes Cesty slibů,
- Promise Detail remains the authoritative editorial case file,
- homepage contains only a simplified teaser / featured journey,
- Promise Detail may contain a small local lifecycle overview.

Specifically decide whether:

### `/explore`

deserves a separate route,

or whether the better design would be:

### `Seznam | Vizuálně`

inside `/promises`.

Choose one.

Do not answer “both could work”.

Also evaluate whether Visual Explorer belongs in primary navigation.

If it belongs there, evaluate the proposed navigation label:

### Prozkoumat

against the feature name:

### Cesty slibů

Judge them on information scent, clarity, memorability and consistency with the rest of the product.

Choose the stronger navigation label. If you recommend a different label, do so only if it is materially better and explain why.

---

# PART 9 — PROMISE DETAIL INTEGRATION

Evaluate whether Promise Detail should contain a small lifecycle visualization such as:

PROGRAM
→ KOALICE
→ ROZHODNUTÍ
→ PENÍZE
→ REALIZACE
→ VÝSLEDEK

with only relevant stages highlighted.

Determine whether this:

- improves orientation,
- duplicates timeline,
- helps explain the domain,
- creates unnecessary UI,
- should be MVP / later / not implemented.

Choose one.

If you choose **MVP**, explain why the navigation/orientation benefit is strong enough to justify adding another visual layer above or beside a timeline that is already intended to be the main narrative backbone.

If you choose **LATER**, state what user-testing evidence or navigation problem would justify introducing it.

---

# PART 10 — HOMEPAGE REVIEW

Evaluate the recommendation that the homepage should **not** contain the full visualization.

Instead it would show:

- the simple lifecycle,
- one featured promise journey,
- a CTA to Cesty slibů.

Determine whether this is the correct level of prominence.

Would a stronger visual teaser improve first-time comprehension and engagement?

Or would it distract from the trust model?

Give a concrete recommendation.

---

# PART 11 — MOBILE STRESS TEST

The proposal intentionally does not shrink the desktop visualization onto mobile.

Desktop:

horizontal layered lifecycle.

Mobile:

vertical sequential journey.

Evaluate whether this is the correct responsive strategy.

Consider:

- touch,
- labels,
- relationship context,
- many-to-many relationships,
- cognitive load,
- scroll length,
- selected states,
- evidence preview,
- navigation back to topic context.

Identify anything that would fail on a 360–390 px mobile viewport.

---

# PART 12 — ACCESSIBILITY REVIEW

Evaluate whether the concept can realistically meet a serious accessibility baseline.

Consider:

- keyboard navigation,
- screen reader interpretation,
- focus order,
- non-colour state,
- reduced motion,
- hover independence,
- equivalent text representation,
- zoom,
- semantic DOM,
- touch target size.

Determine whether the recommendation to use:

React DOM nodes + SVG connectors

is directionally sensible from an accessibility perspective.

---

# PART 13 — TECHNICAL / FRONTEND FEASIBILITY

Current frontend:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

The application already exists.

The proposal recommends **not choosing a graph library first**.

Initial implementation could potentially use:

- React DOM nodes,
- CSS/Grid layout,
- SVG connector layer.

A DAG layout engine could be added later if necessary.

Evaluate this technically at architecture level.

Do not write production code, pseudocode, component code, schemas or implementation snippets. Keep this section conceptual and architectural.

Answer:

1. Is the proposal technically sensible?
2. At what data volume does it stop being sensible?
3. When would Dagre / ELK / React Flow / Cytoscape become justified?
4. Is there any likely hidden complexity in edge routing, crossing reduction or dynamic node sizing?
5. Is the recommended MVP technically realistic?

---

# PART 14 — MVP DISCIPLINE

The guiding principle is:

> one memorable visual exploration feature done very well

not:

> five mediocre visualizations.

Evaluate the proposed MVP scope.

The Phase 2 brief currently describes a relatively broad set of capabilities under the MVP label. Do not assume that everything named there belongs in the first engineering slice merely because each item is individually sensible.

Define the **smallest credible vertical slice** that actually tests the core hypothesis:

> Does following a promise through a deterministic lifecycle view create more comprehension and discovery value than the existing list/detail experience?

Separate:

- functionality required to test that hypothesis,
- functionality required for baseline accessibility and trust,
- convenience features that can wait,
- speculative capabilities that should not be built until usage proves demand.

Do not defer fundamental accessibility, epistemic safeguards or domain truth merely to make the MVP smaller.

Identify anything currently included that should be removed.

Identify anything missing that is essential.

Classify recommendations as:

### MUST HAVE

### SHOULD HAVE

### LATER

### DO NOT BUILD

Be ruthless.

---

# PART 15 — ORDINARY USER TEST

Imagine three users:

## User A — Casual citizen

Does not normally follow politics closely.

Arrives because of a specific issue such as housing.

## User B — Politically interested citizen

Wants to understand what happened after an election.

## User C — Journalist / researcher

Wants evidence, relationships and auditability.

For each user answer:

- Why would they open Cesty slibů?
- What would they understand after 30 seconds?
- What could confuse them?
- Would they return to it?
- Does Promise Detail remain necessary?

The most important test is User A.

Answer:

> Would a normal person genuinely find this interesting beyond the first ten seconds?

Be strict.

Also determine **what kind of real content makes the answer yes**.

For example, is the feature genuinely compelling only when a journey contains transformation, convergence, branching or a meaningful sequence of documented decisions and outcomes?

Would a simple linear journey with only two or three obvious events be better served by Promise Detail?

State the content conditions under which Cesty slibů becomes genuinely useful rather than merely visually novel.

---

# PART 16 — DESIGN QUALITY SCORECARD

Score the proposed Phase 2 direction from 1–10 for:

| DimensionScore               |   |
| ---------------------------- | - |
| Product fit                  |   |
| User value                   |   |
| Ordinary-user appeal         |   |
| Comprehension                |   |
| Trust                        |   |
| Political neutrality         |   |
| Information architecture     |   |
| Interaction design           |   |
| Data visualization integrity |   |
| Mobile UX                    |   |
| Accessibility                |   |
| Technical feasibility        |   |
| MVP discipline               |   |
| Differentiation              |   |
| Long-term scalability        |   |

Then provide:

### Overall design confidence: X / 10

and

### Confidence in your review: X / 10

---

# PART 17 — LOOK FOR SENIOR-LEVEL FAILURE MODES

Explicitly identify whether any part of these documents exhibits common design failure modes such as:

- solution-first thinking,
- graph-for-graph's-sake,
- premature abstraction,
- excessive complexity,
- feature creep,
- over-designed MVP,
- novelty bias,
- desktop-first thinking,
- accessibility treated as an afterthought,
- confusing visualization with product value,
- weak information scent,
- unclear affordances,
- unnecessary new navigation,
- semantics encoded only visually,
- visualization implying causality,
- mixing evidence and assessment,
- political bias through visual encoding,
- treating semantic lifecycle categories as mandatory progress states,
- assuming rich graph topology without checking the actual dataset,
- calling a broad feature set an MVP without defining the smallest testable hypothesis,
- using a generic navigation label with weak information scent.

Do not invent criticism merely to appear rigorous.

If something is genuinely well solved, state that.

---

# PART 18 — SENIOR / PRINCIPAL DESIGN VERDICT

Finish with one of these verdicts:

# APPROVE

The direction is strong enough to proceed essentially as designed.

# APPROVE WITH CHANGES

The fundamental direction is correct, but specific changes should be made before implementation.

# RECONSIDER

The core visual exploration concept should be changed before engineering begins.

# DO NOT BUILD YET

The idea may be valid, but the product is not ready for it or the baseline redesign should take precedence.

Then provide a separate engineering readiness decision:

## ENGINEERING READINESS GATE

Choose exactly one:

### READY TO ENGINEER

The design direction is sufficiently resolved and the available evidence is strong enough to begin the recommended implementation slice.

### PROTOTYPE / DATA VALIDATION FIRST

The direction is promising, but a specific prototype test, dataset audit or both should happen before committing meaningful engineering effort.

### NOT READY TO ENGINEER

The underlying interaction or product decision is still unresolved.

Explain the gate independently from the overall design verdict. A concept can be **APPROVE WITH CHANGES** while still requiring **PROTOTYPE / DATA VALIDATION FIRST**.

Then answer very directly:

> Was choosing “Cesty slibů” instead of a generic Obsidian-style graph a senior-level product design decision?

And:

> Does Phase 2 feel like a natural extension of the original redesign brief, or like a separate feature that was bolted onto the product?

---

# PART 19 — REQUIRED CHANGES BEFORE ENGINEERING

If you choose APPROVE WITH CHANGES, RECONSIDER or DO NOT BUILD YET:

Provide a prioritized list:

## P0 — must resolve before implementation

## P1 — should resolve during implementation

## P2 — can validate later

For each item state:

- problem,
- why it matters,
- recommended correction,
- whether it is a **design change**, **data validation**, **prototype/user validation**, or **engineering constraint**.

If a data morphology audit or prototype test is required, specify the decision it is meant to unlock. Do not ask for research merely as process theatre.

---

# PART 20 — FINAL EXECUTIVE SUMMARY

End with a concise Principal Designer summary suitable for a founder and senior engineer.

Use this exact structure:

### What is correct

### What I would change

### What I would not build

### Biggest product opportunity

### Biggest design risk

### Critical validation still missing

### Engineering readiness gate

### Final recommendation

Do not hedge unnecessarily.

The goal is to decide whether these two documents together represent a **coherent, senior-quality product design direction worth implementing**, and whether the evidence is strong enough to move directly into engineering or whether a targeted data/prototype validation gate should come first.

Do not end with generic UX advice. Make the decision specific to Slib → Skutek, the two attached briefs and the constraints above.