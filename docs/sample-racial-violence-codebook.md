# Sample codebook: newspaper-based racial violence and coercion

**Status:** Working draft for a pilot; not an established project definition.  
**Version:** 0.1, November 17, 2026

## Purpose and scope

This codebook supports a new listing built from newspaper evidence. It records physical violence, threats, and related coercion directed at people in racialized circumstances. It also retains candidates whose racial basis or outcome cannot yet be determined. The examples below illustrate coding choices; they are drawn from unreviewed dossiers and are not final historical findings.

Develop the initial episode, person, and claim records from the newspaper packet. Older inventories are used after that initial coding for comparison, not as a source of cases, facts, or classifications. A comparison may lead a researcher to seek additional newspaper evidence; document the comparison and any resulting change. Do not import a fact from an older inventory as though it were a newspaper finding.

The existing collections use different search periods and coverage. A count is meaningful only alongside its search window, newspapers searched, source availability, and inclusion rules. A collection selected around lynching is not a complete census of other kinds of violence.

## Units and workflow

1. **Episode:** a bounded occurrence or connected sequence at a place and time. Assign a stable `episode_id` that does not depend on a correct name or date.
2. **Person or group:** each identifiable person affected or acting, or an unnamed group when individuals cannot be separated. Link records to the episode.
3. **Claim:** a specific assertion about an episode, person, act, date, or outcome. Link each claim to its source and preserve competing accounts.
4. **Source:** an article or other newspaper item, with its publication details, OCR, page image if available, and relationship to other articles.
5. **Comparison:** a link between the completed initial project record and a row in an outside inventory. One episode can match several victim rows and vice versa.

Start with an episode candidate, assemble its available newspaper packet, record source claims, and code the acts and people. Independently assess inclusion, racial basis, outcomes, and source relationships. Record the coder, date, search window and any unresolved questions. Review the result before matching external inventories. Preserve earlier decisions and changes in a revision log.

### Episode boundaries

Provisionally combine acts connected by the same participants and immediate sequence, such as seizure from jail followed by a killing. Create linked episodes when a later act is separated by substantial time, has a distinct set of actors or targets, or is a separate campaign of violence. Record the reason and the relationship (`continuation`, `retaliation`, `same_alleged_trigger`, or `other`). Do not merge incidents solely because they concern the same person. If the boundary is unclear, keep the alternatives and flag for review.

## Episode fields

| Field | Values and instructions |
|---|---|
| `episode_id` | Stable project-generated identifier. |
| `title` | Neutral descriptive title; revise when evidence changes without changing the ID. |
| `date_start`, `date_end` | Earliest and latest supported event dates in ISO format; use the same date for both if known. Use null for an unknown bound. |
| `date_precision` | `day`, `range`, `month`, `year`, `unknown`. Explain in `date_note` how relative dates were resolved. An article's dateline or publication date is not automatically the event date. |
| `location` | Town, county, state, and specific site as supported; retain variants and location precision. Distinguish dateline, site of seizure, and site of killing. |
| `acts` | One or more codes from the act list; link each act to its claim and affected people. |
| `episode_forms` | Zero or more codes from the form list. |
| `contexts` | Zero or more context codes; these do not establish motive. |
| `racial_basis` | Evidence codes below, with claim citations and a rationale. |
| `project_status` | `include_violence`, `include_coercion`, `review`, or `exclude`; explain the decision. These are project decisions, not claims about a person's experience. |
| `lynching_status` | `meets_definition`, `does_not_meet_definition`, `uncertain`, or `not_assessed`; cite the versioned definition and rationale. |
| `review_status` | `draft`, `human_reviewed`, or `needs_review`; record reviewer and date where applicable. |
| `coverage` | Search dates, newspapers and collections searched, known gaps, and limits on full text or page-image access. |

### Acts: select all supported

| Code | Definition and boundary |
|---|---|
| `threat` | A communicated or demonstrated threat of physical harm. General fear, rumor that violence may occur, and a prediction are not by themselves a threat; retain as claims and review if ambiguous. |
| `physical_attack` | Reported shooting, beating, whipping, stabbing, sexual assault, or other attack on a person. Record the method separately. |
| `killing` | A person is reported to have died from an attack. Code the death claim's certainty separately; do not count a missing person as a confirmed death. |
| `seizure_confinement` | A person is forcibly taken, held, restrained, or prevented from leaving. |
| `attack_occupied_place` | Shooting into, burning, or otherwise attacking an occupied dwelling, church, workplace, vehicle, or gathering. Record whether people were actually present or occupancy was reported but uncertain. |
| `property_destruction` | Reported burning, damaging, or destruction of property. May overlap with an attack on an occupied place. |
| `exclusion_order` | A demand, warning, or order to leave a place or cease an activity. Do not infer departure. |
| `forced_labor` | Reported use of force, confinement, or threat to compel work or return a worker to employment. A labor dispute alone does not meet this code. |
| `other_coercion` | Another documented coercive act; describe it and explain why existing codes do not fit. |

For a thwarted or unsuccessful attack, code the act actually reported and an `attempted` flag. For example, shots fired at a person who is not hit are an attempted physical attack; an unacted-on threat alone is not an attempted shooting. The presence of a code means an act is **reported**, not that it has been established beyond dispute.

### Episode forms and contexts

Forms may overlap: `mob_attack`, `individual_attack`, `official_violence`, `custodial_violence`, `household_attack`, `community_attack`, `other`, `unclear`. Record the conduct underlying each. `Custodial_violence` requires reported detention or custody at the relevant time; use `unclear` when accounts conflict. A posse is not automatically an official actor.

Contexts may overlap: `labor_or_wages`, `debt_or_forced_labor`, `land_or_housing`, `politics_or_elections`, `policing_or_custody`, `alleged_crime`, `racial_exclusion`, `personal_dispute`, `other`, `unknown`. A context code records what sources discuss; it does not by itself prove motive or an alleged crime.

## Racial basis and project inclusion

Code the evidence, not an assumed mental state. Select all that apply and cite the underlying claim:

| Code | Evidence |
|---|---|
| `explicit_racial_language` | A reported racial threat, statement, or asserted purpose connects the act to race. |
| `group_targeting` | A report describes people or a gathering selected as members of a racial group. |
| `racial_exclusion` | A report describes force or coercion enforcing racial exclusion from a town, work, housing, political activity, or other setting. |
| `racial_basis_disputed_or_unclear` | A racial interpretation is reported or plausible but the available evidence does not establish it. Record competing explanations. |
| `not_established` | Reviewed sources identify racial identities but provide insufficient evidence to determine a racial basis. This is not proof that race was irrelevant. |

**Pilot inclusion rule:** use `include_violence` for a reported physical attack, killing, or credible threat with at least one of the first three racial-basis codes supported by cited source evidence. Use `include_coercion` for a supported exclusion, forced-labor, or comparable coercive act with one of those racial-basis codes; it may also qualify as violence. Use `review` if the occurrence, outcome, or racial basis is materially contested or insufficient to apply the rule. Use `exclude` when the candidate falls outside the stated project scope, explaining why. These thresholds require pilot review before production.

Do not infer racial purpose solely from the racial identities of victim and perpetrator. Do not infer a perpetrator's race from a victim's race. A discriminatory act or strike without a reported threat or physical attack may fit the coercion collection without meeting the narrower violence rule.

## Persons, groups, and actors

Use a `person_id` and retain source spellings as alternatives. Record reported race, gender, and age with provenance; do not infer missing characteristics from names. Use an unnamed group record when the number or identity of individuals cannot be resolved; provide a minimum and maximum where supported and do not count a group as one person by default.

For each affected person, link the act and record role (`attacked`, `threatened`, `seized`, `displaced`, `possibly_intended_target`, `other`) and outcome (`killed`, `injured`, `no_injury_reported`, `departed`, `fate_unknown`, `disputed`). Multiple roles and outcomes may apply. Separate a reported departure from its asserted cause. A reported potential target is not automatically an injured victim.

For actors, record role (`private_individual`, `crowd`, `employer`, `police`, `jailer_or_guard`, `military`, `posse`, `other`, `unknown`), reported size or range, racial description if stated, and authority (`official`, `private`, `mixed`, `unclear`). Record names only as supported. If sources say a mob was unidentified, that is not proof that no one knew who participated.

## Claims, sources, and uncertainty

Each claim should contain an identifier, episode/person/act reference, field, value or narrative, source citation and passage, publication date, and coder notes. Preserve alternative claims rather than overwriting them. Use the following evidence assessments:

- `single_account`: one identified account or one underlying report, even if reprinted.
- `multiple_independence_unclear`: multiple publications but uncertain source relationships.
- `independent_corrob`: at least two accounts with a documented basis for judging them independently sourced on the particular claim.
- `disputed`: sources disagree about the particular claim; store each version and its support.
- `insufficient`: the claim or relevant source cannot be assessed from available evidence.

These describe evidence, not automatic probabilities. `disputed` may coexist with corroboration for one version. A report of a death can be well supported while the cause, timing, or racial motive remains uncertain. Record each separately. Distinguish `not_reported` (searched source is silent), `reported_absent` (source explicitly denies it), and `unknown` (not assessed or no information). Do not convert a newspaper accusation into a fact.

Source fields should include publication, date, page, title, URL or archive identifier, item or article ID, press classification and its basis, text access, and a link to OCR and page image where available. Code relationships such as `reprint_of`, `shared_wire`, `independent_on_claim`, or `uncertain`; explain the evidence for independence. Black and white newspapers can reprint the same wire. OCR is a transcription aid, not an authoritative image: flag passages that affect classification or identity for image verification if text is garbled or segmented incorrectly.

## Old-inventory comparison

After initial newspaper coding, record `inventory_name`, `inventory_version`, `inventory_row_id`, matched `episode_id` and `person_id`, `match_confidence` (`confirmed`, `probable`, `possible`), rationale, and differences by field. Store the old record as a comparison claim with its own provenance. Never copy its date, name, method, or classification into the independent record without locating supporting evidence. If comparison prompts a new newspaper search, log the source and revision; keep the initial coding available.

## Illustrative pilot cases

| Case | Sample coding | Main review question |
|---|---|---|
| [Pittsville, Texas, 1888](../lynching/1888/cases/lamar-johnson-1888-10.json) | `attack_occupied_place`, `physical_attack`, `killing`; community attack; reported targeting of a Black congregation. | Political motive is reported and disputed; the Black-paper reprint may not be independent. |
| [Albert West, Indiana, 1888](../lynching/1888/cases/albert-west-indianapolis-1888-03.json) | `physical_attack`, `killing`; official and custodial violence; racial basis `not_established`; project status `review`. | The guard's account of the struggle is not independently established in the dossier. |
| [Dargan household, South Carolina, 1888](../lynching/1888/cases/dock-dorgar-bennettsville-1888-05.json) | `attack_occupied_place`, `physical_attack`, `killing`; one child reported killed; father a possible intended target. | Shooters' race and motives are not established by the examined accounts; distinguish alleged threats against Dock from the shooting. |
| [Bluffton, Indiana, 1880](../1880/cases/bluffton-bluffton-1880-08.json) | `exclusion_order`; racial exclusion; one departure reported; physical assault not reported. | Determine whether notices include a threat of physical harm; do not equate the order with physical expulsion. |
| [Will Waters, Georgia, 1903](../1903/cases/will-waters-macon-1903-07.json) | `seizure_confinement`, `physical_attack`, `forced_labor`; labor/debt context. | Code racial basis from specific newspaper evidence, and distinguish the abuse date from prosecution dates. |
| [Will Morrison, Illinois, 1920](../1920/cases/will-morrison-coulterville-1920-08-16.json) | `property_destruction`, `exclusion_order`; reported departure; racial and labor context. | Additional reported shootings and other burned homes are disputed; do not count them as established. |
| [Smith and Coleman, Georgia, 1888](../lynching/1888/cases/tim-smith-washington-1888-11-27.json) | Reported seizure, killings and separate whipping victims; drowning reported; status `review`. | One account relays a concealment report, and the reported river search found no bodies. Separate death and method certainty. |

## Pilot and revision

Two coders should independently apply this draft to a small, varied newspaper packet without seeing each other's codes or older-inventory rows. Compare episode boundaries, acts, racial-basis evidence, inclusion, and victim outcomes; log disagreements and the source passages that resolve them. Review page images where OCR is consequential. Revise definitions and version the codebook before scaling; keep unresolved cases and the original decisions. Do not interpret agreement as evidence that the newspaper record itself is complete or accurate.
