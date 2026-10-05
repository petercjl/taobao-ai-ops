---
name: taobao-ai-operations
description: Route a Taobao operator's research request to independently usable category-opportunity and search-product research nodes, preserve evidence handoffs, and track a multi-node research run.
---

# Taobao AI operations

Input: an operator's goal, supplied workbooks or authorized data sources, optional existing research and run directory. Output: the selected node's full deliverables, a versioned run plan and, when requested, an evidence-bound handoff. This suite currently implements category research and product research. Supply-chain validation, content creation and operating reviews are planned extensions reported as unavailable until registered.

## Main line

1. Resolve the requested business result with `taobao-ai-ops nodes list --json`. A category/monthly market question uses `category-research`; a search-result workbook and concrete research object use `product-research`. Existing product scope can enter product research directly. If no supported node covers the request, report the missing node.
2. Run `taobao-ai-ops doctor --node NODE --mode excel --json` for local workbooks, or `--mode nas` for live category data. Doctor checks deterministic resources; verify any listed native capabilities in the active Agent before their stage. A missing dependency ends the affected node with its exact error.
3. Resolve the exact child Skill with `taobao-ai-ops skill source --name SKILL --json`. Read its complete current SKILL.md, load its platform adapter, then follow only the child node's current reference routes. The logical dependencies are `yuce-category-opportunity-report` (method contract `yuce-category-opportunity@2.0`) and `taobao-search-product-form` (imported method `0.1.1`). Their returned artifacts and source hashes are the handoff; resolution or contract failure stops with CAPABILITY_UNAVAILABLE or OUTPUT_CONTRACT_FAILED. Return here at step 4 after the child completes. Naming a Skill alone is not execution.
4. Preserve the child's analysis, full HTML and evidence files. Use `taobao-ai-ops workflow plan --run-dir NEW_DIR --node NODE --input WORKBOOK --json` when a durable suite plan is requested; this records a plan and fixed suite/method versions, not business completion. The product node's own stage ledger remains authoritative for its detailed execution.
5. For category-to-product handoff, obtain the selected full category path and explicit search query. Use `taobao-ai-ops handoff create --node category-research --input ANALYSIS.json --candidate FULL_PATH --query QUERY --out NEW_HANDOFF.json`. It preserves the selected evidence and its source hash. Request or obtain an authorized search-result workbook before running product research. Category growth retains its category/time grain; it is not a product-growth fact.
6. Deliver the complete child result and the current next research question. A handoff with missing input is needs_input; a plan or resource probe is not verified business output.

## Execution and branches

Component scripts run via `taobao-ai-ops script NODE SCRIPT ...`; supplied Excel does not require platform accounts. Optional platform calls use `taobao-ai-ops tool run TOOL ...` so the shell selects the installed independent component. Accounts, warehouse access and write permissions remain external. The category child's database-consent and additive-import boundaries apply in its NAS route.

When a child was installed by the shell, forward its CLI examples through `taobao-ai-ops component run COMPONENT ...`, retaining all remaining arguments. This resolves the actual independent package even when its CLI is not on PATH or another global version exists. Use the shell's unified update entry for shell-managed components; a child's standalone global updater belongs only to independent global installations.

The shell registers independent npm packages; each owns its method, resources and release. Ordinary tasks use installed versions. On an explicit install/update request, use `taobao-ai-ops skill install --agent AGENT` or `taobao-ai-ops update install --agent AGENT --yes`; the latter checks both shell and every registered component's stable latest version even when the shell is unchanged. Inspect returned versions and managed Skill state. Registry failure preserves current components; local edits stop synchronization. Missing components return COMPONENT_NOT_INSTALLED and require authorized installation before returning to step 2. Development registrations update through their Git owners and are reported separately. Skill source resolves to each component's own canonical package, not a shell copy.

Current node selection and source resolution are deterministic contracts, with method judgment owned by each child Skill. The package manifest is the node registry and shared contracts are maintained in the package's contracts directory. Do not load unrelated node methods at startup.

Missing native image observation stops product visual analysis; an unverified substitute cannot satisfy it. Changed upstream evidence invalidates its downstream comparison. Node-specific evidence disagreements are resolved by the child QA before returning to step 4.

## QA and maintenance

Confirm the selected node, actual source path, method version, source hashes and full output contract. Keep every Skill's tests independent and exercise suite installation, dependency closure and handoffs separately. Suite targets are implemented, with actual Agent/OS runtime evidence recorded separately. Clean-context regression requires an explicit user request. New business nodes enter the suite registry only with an independent I → S → O, execution and QA contract.
