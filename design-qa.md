# RumahBudget Vault Split — Design QA

## Evidence

- Selected visual source:
  `C:\Users\Lenovo\.codex\generated_images\019fa1b2-29dd-7043-8cef-ae0790c58447\call_QKt2DI2QRu7FvL7DbQ8S95zU.png`
- Authenticated implementation capture with privacy active:
  `C:\Users\Lenovo\Desktop\project kanzan\rumahbudget\tmp\design-qa\vault-split-desktop-final-redacted.png`
- Same-input visual comparison:
  `C:\Users\Lenovo\Desktop\project kanzan\rumahbudget\tmp\design-qa\vault-split-comparison-final.png`
- Runtime: `http://localhost:3001/`
- Desktop browser viewport: 1707 × 817 CSS px.
- Mobile responsive override: requested 390 × 844; Chrome reported
  434 × 938 CSS px after browser scaling.
- State: authenticated overview, real values hidden, personal account label
  redacted from the saved comparison capture.

## Comparison Result

The implementation adapts the selected Vault Split composition rather than
copying it:

- A compact financial spine carries balance, status, runway, burn, life
  energy, account count, privacy, and data-mode context.
- The truthful current-period cashflow chart is the dominant hero surface.
- Real voxel cash assets replace flat placeholder bars. Privacy mode equalizes
  and neutralizes every stack so geometry and polarity do not leak.
- Account and expense composition remain connected to the hero chart.
- The recent-activity ledger begins inside the first desktop viewport.
- Supporting planning, diagnostics, survival, sandbox, reports, allocation,
  commitments, and settings remain reachable below or through navigation.

The visible differences from the concept are intentional data adaptations:
the implementation uses only the three existing current-period totals and
stored account/category compositions. It does not invent the category history,
trend line, or extra financial series shown in the concept image.

## Responsive and Accessibility Evidence

- Desktop: `document.body.scrollWidth` and
  `document.documentElement.scrollWidth` were 1690 px against a 1707 px
  viewport; no horizontal page overflow.
- Desktop recent ledger top: 771 px in an 817 px viewport.
- Mobile: body/document width 417 px against a reported 434 px viewport; no
  horizontal page overflow.
- All 28 visible mobile buttons, inputs, selects, and textareas were at least
  44 px high.
- Mobile navigation exposed Ringkasan, Transaksi, Catat, Akun, and Lainnya.
- The Lainnya dialog opened, exposed the four secondary destinations, and
  closed successfully.
- The private planning input accepted a cumulative four-digit value while its
  rendered type remained `password`; the prior value was restored after the
  test.
- The sidebar scrollbar uses a thin graphite track and muted olive thumb.
- Privacy stayed active for every saved implementation capture.

## Interaction Evidence

- All eight product views were reached in the authenticated browser:
  Ringkasan, Akun, Catat, Transaksi, Laporan, Alokasi, Simulasi, and
  Pengaturan.
- Command-K opened the existing command console and Escape closed it.
- The sandbox switch changed to simulation mode and was restored to the
  original ledger mode.
- The planning input remained editable while its value was masked.
- No destructive transaction, account, report, or diagnostic action was
  submitted.

## Verification

- `node scripts/check-ui-preservation.mjs`: passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed; Git emitted line-ending conversion warnings
  only.
- Browser console warnings/errors filtered to `localhost:3001`: none.
- `npm run build` was not run because project instructions require asking
  before an expensive build.

## Comparison History

- Iteration 0: previous visual-only shell lacked authenticated runtime proof.
- Iteration 1: Vault Split layout passed hierarchy review, but the chart used
  flat rectangular bars and the ledger sat below the first viewport.
- Iteration 2: real voxel cash stacks replaced the bars; privacy geometry was
  equalized.
- Iteration 3: wide-desktop spine metrics/actions were compacted into a
  two-column ledger, bringing recent activity into the first viewport.
- Iteration 4: the sidebar scrollbar was brought into the graphite/olive
  visual system. Final same-input comparison found no remaining actionable
  P0, P1, or P2 mismatch.

final result: passed
