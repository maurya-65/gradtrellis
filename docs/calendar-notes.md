# UNB calendar research notes

Findings that shape the data model. Every rule in `data/programs` must trace back to a source listed here.

## Sources

| Document | URL | Notes |
|---|---|---|
| Undergraduate Calendar 2021-2022 (PDF) | https://www.unb.ca/secretariat/_assets/documents/calendar/undergradcalendar-2021-2022.pdf | BCS: PDF pp. 356–357 (printed 352–353). |
| Undergraduate Calendar 2022-2023 (PDF) | https://www.unb.ca/secretariat/_assets/documents/calendar/undergradcalendar-2022-2023.pdf | BCS: PDF pp. 374–375 (printed 370–371). |
| Undergraduate Calendar 2023-2024 (PDF) | https://www.unb.ca/secretariat/_assets/documents/calendar/undergradcalendar-2023-2024.pdf | BCS: PDF pp. 196–197 (printed 192–193). |
| Undergraduate Calendar 2024-2025 (PDF) | https://www.unb.ca/secretariat/_assets/documents/calendar/undergradcalendar-2024-2025.pdf | BCS: PDF pp. 201–203 (printed pp. 197–199). Grading: PDF p. 39 (printed 35–36). Repeats: PDF p. 36–37. |
| Undergraduate Calendar 2025-2026 (PDF) | https://www.unb.ca/secretariat/_assets/documents/calendar/undergradcalendar-2025-2026.pdf | BCS: PDF pp. 212–214 (printed 208–210). |
| Undergraduate Calendar 2026-2027, BCS (HTML) | https://www.unb.ca/academics/calendar/undergraduate/current/frederictonprograms/bachelorofcomputerscience.html | Encoded as `bcs-2026-2027.json`. Published 16 March 2026; there is no 2026-2027 PDF. The site serves it under `current/`, so archive a copy before the next year replaces it. The HTML archive for 2024-2025 returns 404; older years exist only as PDFs (see https://www.unb.ca/secretariat/calendar-archive.html). |
| Current calendar, course listings (HTML) | https://www.unb.ca/academics/calendar/undergraduate/current/frederictoncourses/ | One page per subject (e.g. `computer-science/index.html`). Each course is a `<table>` with code, title, credit string, `<course_description>`, `<course_prereq>`, `<course_coreq>`. The PDFs do **not** contain course descriptions or prereqs. |
| Web timetable | https://es.unb.ca/apps/timetable/ | Sections, times, term offerings. Not scraped yet (M2/M5). |
| FCS timetable | https://www.cs.unb.ca/course-timetable | CS-only term view. |

## Two different versioning rules

- **Degree requirements** follow the calendar in effect when the student **entered** the program (2024-2025 for a Sept 2024 entrant). Calendar clause 4 lets UNB impose revised requirements "where practicable", so the engine must be able to audit against a newer calendar on request.
- **Course prerequisites** are enforced at registration, so they come from the calendar in effect for the **term the course is taken**. In practice that means the current course listings. Course data is therefore versioned by snapshot date, separately from program rules.

## What changed between calendars (2021-2022 to 2026-2027, all encoded)

Everything not listed here is identical across all six years: the 40-course/133 ch total, the C minimum, the
7 technical electives with their level and programming counts, the 10-course breadth pool, 4 free electives,
the 12 ch writing requirement, the load advice and the Honours rules.

| Rule | 2021-2022 | 2022-2023 | 2023-2024 | 2024-2025 | 2025-2026 | 2026-2027 |
|---|---|---|---|---|---|---|
| Three-fail rule | none | yes | yes | yes | yes | yes, "withdraw from the Faculty" after Faculty review |
| Non-credit list | no CS 2704, no MATH 1843 | full list | full list | full list | full list | full list |
| Math Option B electives | no MATH 4503 | + MATH 4503 | same | same | + STAT 3093 | + STAT 3093 |
| Cybersecurity courses | six fixed: CS 2413, 4335, 4411, 4417, 4419, 4865 | same six | CS 2413, 4335, 4411, 4417, 4865 + one of 4413/4415/4419 | CS 4355 replaces 4335 | same | same |
| Databases core course | CS 1103 | CS 1103 | CS 1103 | CS 1103 | CS 1103 | **CS 1543** |
| Programming marker | [P] | [P] | (P) | (P) | (P) | [P] |

Wording-only differences (no rule change): "credit hours' worth" up to 2023-2024, "Software Engineering I" as the
title of CS 2043, "Cybersecuirty" misspelled in the heading up to 2023-2024, and "an extensive computer
programming component" in 2021-2022.

### CS 4335 doesn't exist

The 2021-2022 to 2023-2024 calendars name **CS 4335** in the cybersecurity specialization. That code has never
appeared in the course listings; **CS 4355 Cryptanalysis and Database Security** holds the same position from
2024-2025 on. The program files accept CS 4355 for it, unconfirmed, so the audit flags it for review. Ask FCS.

## Courses named in the 2024-2025 BCS rules that have changed

Found by `backend/test/data.test.ts`, which compares the program file to the current listings.

| Code | What happened | How GradTrellis handles it |
|---|---|---|
| CS 1103 Intro to Databases (core) | Not listed any more. Current CS 1543 "Introduction to Databases": "Credit can only be obtained for one of CS 1543, CS 1103, INFO 1103." | `acceptAlso: CS 1543, INFO 1103`, marked unconfirmed. Ask FCS. |
| MATH 3353 Computational Algebra (Math Option B list) | Not listed any more | Still counts if already taken; can't be planned. |
| CS 2704, ECE 2213 (non-credit list) | Not listed at Fredericton | No effect. |

## Other course-listing rules that affect BCS

- CS 1203: "may not be taken for credit by BCS students beyond first year." GradTrellis reads "first year" as the academic year of entry. Needs confirming.
- CS 1023 and CS 1093: never for BCS credit.
- The HTML listings put some corequisites inside the prerequisite element (e.g. CS 2253). The scraper separates them.
- The French department prints credit as "3 cr" instead of "3 ch".

## UNB grading (Section B, 2024-2025)

- Letter grades and points: A+ 4.3, A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, D 1.0, F 0.0, WF 0.0.
- Credit hours are earned with D or better, but BCS requires **C or better** for any course used toward the degree.
- F and WF count as attempted hours in GPA and earn no credit.
- Notations: INC, AEG (pass standing), AUD (audit: no credit), CR/NCR, X (extra: not credited to the program, not in GPA), # (grade shown but not in GPA, after appeal), W (withdrawn, no penalty), CTN (continues next term), EL (experiential learning course flag).
- GPA = Σ(ch × points) / attempted ch. Assessment GPA excludes W, #, X. Shown to one decimal place.
- Repeats: every attempt counts separately in GPA; credit hours count **once** toward the degree. At most 3 attempts (W counts as an attempt, # does not); a 4th needs the Dean's permission.
- BCS 3-fail rule: 3 failing grades (D, F, WF, NCR) in the same course means withdrawal from BCS. W, # and X don't count toward this.
- Standing: assessment GPA below 2.0 means probation (allowed once); 1.0 or below means required to withdraw for 12 months.

## Things the calendar leaves to human judgment (engine must flag, never decide)

- "Another approved MATH/STATS elective at the 2000 level or above, approved by the Assistant Dean (Undergraduate)"
- "Selected ECE courses … with prior approval" toward breadth
- "approved technical elective", "approved free electives"
- Faculty review before the 3-fail withdrawal
- Any "permission of the instructor" prerequisite
