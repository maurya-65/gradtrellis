# Golden student histories

Each file is one student record plus the answers an advisor would give. Because we have no
FCS reviewer yet, these fixtures are the main check on the engine: **every rule change must keep all of them passing.**

## Rules for expected values

- Work them out **by hand from the calendar**, never by running the engine and copying its output.
  Put the arithmetic in the `*Working` fields and any reasoning in `notes`, so a reviewer can check it.
- Cite the calendar interpretation when a case depends on one (see `interpretationNotes` in the program file).
- `reviewedBy` lists the people who checked the expected values against the calendar. A case
  with an empty list is our best reading, not a verified one.

## Adding a real (anonymized) history

1. Remove anything identifying: name, student number, email. Keep only course codes, terms and grades.
2. Set `"provenance": "anonymized-real"`.
3. Work out the expected values by hand, or better, from an actual advising outcome.

## Fields

| Field | Checked from |
|---|---|
| `expect.cgpa` | UNB GPA rules (calendar section B) |
| `expect.warnings` | Policy warnings: fail limit, attempt limit, reduced load |
| `expect.audit.status`, `totals` | Degree audit: overall status, counted courses and credit hours (completed and in progress) |
| `expect.audit.requirements` | Keyed by requirement id anywhere in the tree. `status` always; optionally `used` (exact set of courses), `includes` (must contain) and `chosenOption` (for Option A/B style choices) |
| `expect.audit.designations` | Honours, specializations: `status` and optional `tier` |
| `expect.audit.notCounted` | One entry per transcript line that counts toward nothing (repeats, below C, excluded, non-credit) |

Only assert placements an advisor would insist on. When a course could validly sit in two requirements (a CS course as a technical or free elective), assert the requirement's status rather than the exact set.
