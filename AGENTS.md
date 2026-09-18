# EV Charging Tool

## Mandatory Planning Rule

**You MUST create a plan before writing any code.** This is non-negotiable.

1. Create a plan file in the `.plans/` folder before starting any coding task
2. Name the file with an incrementing number and short slug: `000-short-slug.md`, `001-another-task.md`, etc.
3. The plan must contain bullet points with checkboxes using the following states:
   - `[ ]` — pending (not yet started)
   - `[o]` — in progress (currently working on)
   - `[x]` — completed
4. **Present the plan to the user and WAIT for explicit approval before writing any code**
5. When you start working on a task, immediately mark it as `[o]`
6. When a task is done, mark it as `[x]`
7. Only then proceed to the next task
8. **When all tasks are completed, update the relevant documentation files (DATAMODEL.md, TECH.md, AGENTS.md, README.md) if the changes require it**
9. **After all tasks are completed, append a "Summary & Learnings" section to the bottom of the plan file.** This retrospective should capture, in a few concise bullet points:
   - **Ups** — what went well, what worked smoothly
   - **Downs** — what was harder than expected, what went wrong, dead ends
   - **Challenges** — the tricky parts, gotchas, and how they were solved
   - **Learnings** — reusable insights, patterns, or warnings that will help with future similar tasks

**Example** (`.plans/003-add-export-button.md`):
```markdown
# Add CSV Export Button to Sales Module

- [x] Identify where export logic should live
- [o] Create export utility function in shared
- [ ] Add button to SalesOverviewTab
- [ ] Wire up click handler to trigger download
- [ ] Test with sample data

## Summary & Learnings

- **Ups:** Reused the existing `useFormatter` hook; export logic dropped into shared cleanly.
- **Downs:** TanStack Table column state made it tricky to grab the filtered rows.
- **Challenges:** Had to read filtered rows from the table instance, not the raw data — solved via `table.getFilteredRowModel()`.
- **Learnings:** For any future export button, pull rows from the table instance so filters/sorting are respected.

