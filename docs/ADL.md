<!--
Responsibility: Architecture Decision Log for the NCC NEXUS COMMAND (Intelligence / Decision / Adjutant) initiative.
Layer: Project documentation (no runtime code).
Depends on: the approved SDD and Repository Integration Blueprint.
Must never be depended on by: any source code — this is a human-facing record only.
Append a new ADL-NNN entry whenever an architectural decision affects future implementation.
-->

# Architecture Decision Log — NCC NEXUS COMMAND

Format per entry: **Decision** · **Why** · **Alternatives considered** · **Rejected because** (when applicable) · **Consequence**.

Entries are append-only. Existing decisions are never rewritten; if a decision changes, a new ADL entry supersedes the previous one while preserving history.


---

## ADL-001 — Intelligence Layer reads existing tables via a dedicated read-only repository
- **Decision:** The Intelligence Layer reads existing data directly through a dedicated repository that issues SELECT-only queries.
- **Why:** Avoid modifying existing services and controllers.
- **Alternatives considered:** Reuse the existing service layer.
- **Rejected because:** Existing services are user/request-oriented and would tightly couple new intelligence code to them.
- **Consequence:** Legacy application remains untouched; the Intelligence Layer stays isolated and independently testable.

## ADL-002 — Additive-only architecture
- **Decision:** All intelligence work lives in new modules (`modules/intelligence`, `modules/decision`, `modules/adjutant`) and new tables only.
- **Why:** The existing app is production; zero regression is required.
- **Alternatives considered:** Extend/refactor existing modules to host new logic.
- **Rejected because:** Any edit to working modules risks the frozen features (attendance, quiz, meetings, etc.).
- **Consequence:** Only additive route registrations in `app.js` and additive frontend routes are allowed; the feature is fully reversible.

## ADL-003 — Precomputed snapshots instead of live aggregation
- **Decision:** Readiness scores are precomputed into snapshot tables. For the MVP, recomputation is manual through `POST /api/intel/recompute`; automated scheduling will be introduced only after the architecture is validated.
- **Why:** Snapshot-based computation provides O(1) read performance, historical trend analysis, reproducible recommendations, and predictable system behaviour.
- **Alternatives considered:** Aggregate scores dynamically on every request.
- **Rejected because:** Live aggregation requires joining multiple operational modules for every request, increases latency, complicates caching, and provides no historical record.
- **Consequence:** Scores may become slightly stale between recomputations, but the architecture remains scalable, deterministic, and easy to audit. Automated scheduling is intentionally deferred until the vertical slice is validated.

## ADL-004 — Explainable deterministic scoring, not trained ML
- **Decision:** Pillar scores are pure-function, deterministic formulas with tunable weights stored in `scoring_config`.
- **Why:** No dataset exists; defence-context requires trust; the design must be viva-defensible.
- **Alternatives considered:** Train a custom ML model to produce scores.
- **Rejected because:** No labelled data, and a black-box score is neither explainable nor auditable.
- **Consequence:** Every score is traceable to source rows and a visible formula; weights are versioned and adjustable.

## ADL-005 — Confidence-aware aggregation (absence of data = low confidence, never zero)
- **Decision:** Overall readiness is a confidence-weighted blend; missing pillars lower confidence and are reweighted, never scored 0.
- **Why:** Fairness to new or under-resourced cadets.
- **Alternatives considered:** Treat missing data as a 0 score.
- **Rejected because:** It unfairly penalizes cadets who lacked the opportunity to generate data.
- **Consequence:** Both the Overall score and its confidence are surfaced to officers.

## ADL-006 — AI Adjutant uses whitelisted read-only tools; the LLM never touches the database
- **Decision:** Gemini function-calling can invoke only an allowlisted set of read-only, college-scoped tools; `college_id` comes from the JWT; consequential actions require human approval.
- **Why:** Prevent prompt-injection, hallucinated data, and cross-tenant leakage.
- **Alternatives considered:** Give the LLM direct DB/SQL access.
- **Rejected because:** It would expose write paths and untrusted-input risk.
- **Consequence:** The agent can only call safe read functions; it proposes actions, the officer disposes.

## ADL-007 — New `adjutant.gemini.service.js`, separate from `bot.service.js`
- **Decision:** The Adjutant uses a new Gemini service; the existing chatbot service is not modified.
- **Why:** The cadet chatbot is a frozen, working module.
- **Alternatives considered:** Extend `bot.service.js` to add function-calling.
- **Rejected because:** It couples new logic to a frozen module and risks a regression.
- **Consequence:** The chatbot is untouched; Gemini/tool logic is isolated and swappable.

## ADL-008 — Delay new UI dependencies until the Intelligence pipeline is validated
- **Decision:** The MVP will use existing UI components together with lightweight SVG/CSS visualisations. External charting libraries will not be introduced until the Intelligence pipeline has been validated end-to-end.
- **Why:** The primary objective is proving the architecture rather than polishing visualisation.
- **Alternatives considered:** Introduce Recharts during the first implementation milestones.
- **Rejected because:** Additional dependencies increase complexity without reducing implementation risk at this stage.
- **Consequence:** Initial dashboards remain simple while the backend architecture stabilises. Visualization libraries may be introduced later without affecting the Intelligence Layer.


## ADL-009 — Decision Layer is deterministic and rule-based (no AI)
- **Decision:** Recommendations (RDC selection, promotion, at-risk, etc.) are produced by deterministic rules over scores.
- **Why:** Explainability, reproducibility, and defensibility.
- **Alternatives considered:** LLM-generated recommendations.
- **Rejected because:** Non-deterministic and hard to justify to an officer/examiner.
- **Consequence:** Every recommendation is reproducible and auditable; the AI is confined to the Adjutant interface.

## ADL-010 — Vertical-slice milestone order (attendance end-to-end first)
- **Decision:** Build one pillar (attendance) through the full stack — repository → scorer → snapshot → endpoint → UI — before adding the other pillars.
- **Why:** Validate the entire pipeline with minimal code and reach a demoable state early (M3).
- **Alternatives considered:** Build all seven scorers before any endpoint/UI (original SDD order).
- **Rejected because:** Integration flaws would surface late, after seven scorers instead of one.
- **Consequence:** Earlier demo and earlier risk detection; remaining pillars slot into a proven pipeline.



## ADL-011 — Legacy Compatibility Contract
- **Decision:** Existing modules, APIs, database schema, authentication flow, chatbot, payment system, and operational business logic are treated as frozen. Intelligence features extend the system without modifying existing behaviour.
- **Why:** NCC NEXUS is already a functional platform. The objective of COMMAND is to enhance the platform rather than refactor or replace working functionality.
- **Alternatives considered:** Integrate Intelligence by modifying existing modules.
- **Rejected because:** Modifying production logic significantly increases regression risk and complicates testing, rollback, and team collaboration.
- **Consequence:** Existing functionality must remain behaviourally identical throughout development. All Intelligence features are implemented as isolated modules with additive routes, migrations, and frontend pages. Any exception requires explicit architectural approval and must be documented in a future ADL entry.