## What failed, and how this fixes it

<!-- The failure in a sentence (link the issue), the cause, and the fix. -->

## Proof

<!-- Before and after screenshots for anything visual, at 1× and a 4× close-up. -->

## Checklist

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm verify`, `pnpm verify:controls`, `pnpm check:embed`, `pnpm check:reproducible` and `pnpm check:drawing` pass
- [ ] No number, order or outcome is typed into a view, caption or narration; it comes from the model
- [ ] A new check has a planted fault that `verify:controls` catches
- [ ] A line in `CHANGELOG.md` under **Unreleased** names the failure behind this change
- [ ] I looked at the real pages, not only the check results
