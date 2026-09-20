## What changes

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The motivation. An issue, a bug, a gap. Not "what" again — the diff shows that. -->

---

## Checks

Run these locally; CI runs the same six and will fail the PR otherwise.

```bash
node scripts/check-manifest.mjs
node scripts/compose-agents.mjs --check
node scripts/run-evals.mjs --check
node scripts/check-neutrality.mjs
node scripts/check-version-bump.mjs
node scripts/build-catalog.mjs   # then confirm `git diff` is clean
```

- [ ] The six guards pass locally
- [ ] `README.md` and `docs/marketplace.html` were **regenerated, not hand-edited**
- [ ] Every plugin whose content changed has a **new `version`** in its `plugin.json`

<!--
Editing one shared standard recomposes every agent that includes it, across
several plugins, silently. Each of those plugins needs its own bump, or
installed consumers never receive the change.
-->

- [ ] `CHANGELOG.md` updated under `[Unreleased]`

## Project neutrality

- [ ] No facts about any single organisation or project — no internal hostnames,
      private addresses, credentials, corporate contacts, or brand names
- [ ] Where a project fact was tempting, a **detection instruction** was written instead
- [ ] Any concrete example is marked as an illustration of the pattern

<!--
Agents here run in repos their author will never see. See
plugins/common/standards/project-grounding.md.
-->

## Agent or standard changes

<!-- Delete this section if the PR touches neither. -->

- [ ] Universal practice was pulled in with `@include`, not copy-pasted
- [ ] Agent bodies hold only what is genuinely particular to their stack
- [ ] Evals still pass: `node scripts/run-evals.mjs --run --plugin <stack>`

<!--
New assertions: a `mustNotMention` names an ACTION, never a noun — a noun also
matches the correct refusal. A `mustMention` asserts the mechanism, not the wording.
-->

## Consumer impact

<!--
Who is affected on their next `/plugin marketplace update`, and does anything
break for them? Write "none" if nothing changes for an installed user.
-->
