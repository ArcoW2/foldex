---
name: plans
description: How to write, revise and close a plan or design document. Use whenever asked to create, write, update or revise a plan, to record answers to a plan's open questions, to execute a plan (closing it afterwards), or to report what is left of one.
---

# Plans

## Where and when

- Save a plan in the project's `docs` folder (or its plans folder, e.g. `docs/plans/`); when there is no docs folder,
  in the main project folder.
- Follow the project's own conventions when it has them: numbering (e.g. `NN-PLAN-name.md`, the number being the
  priority), a Status line, a folder for executed plans (e.g. `docs/plans/executed/`). Look at existing plans first.
- Writing a plan is not executing it. Do not start building until the user explicitly says so; stay in plan mode.
- Plain ASCII only, as everywhere.

## Structure

At the top, under the title, a **Status line** with the plan's state (`not started`, `partly executed` or
`executed`) and where to look, then a list of its changes, one per line, oldest first: `- <date>: draft.`,
`- <date>: revised: <what changed>.`, `- <date>: partly executed: <what>.`, `- <date>: executed.` Notes such as
what the plan builds on follow the list as a paragraph of their own.

1. **What the plan is about**: the defect or the enhancement.
2. **The solution, in brief**: a few lines at most, prose only. No code, no SQL, no examples, no options table, no
   rejected alternatives.
- **Status** (unnumbered, so the numbers of the other sections and every reference to them stay put): what of this
   plan is built and what is not, as two subsections, **Built** and **Not yet built**, each a table:
   - Built: `| Part | What | Reference |`.
   - Not yet built: `| Part | What | Waits for | Reference |`.

   Part is a short name, What a short description, Waits for another part, plan or open question (`--` when
   nothing), Reference the section in this plan or another (`3.2; 6.1`, `plan 02 3.5`). A subsection with nothing in
   it stays empty: just its heading. Parts moved to another plan go in a line below the Not yet built table
   ("Moved out: ... to plan NN."). Every plan has this section from its first draft. Plans are not built one after
   another, so this section is the record of where each plan stands: keep it current whenever a part is built, a
   part is added or dropped, or a part moves to another plan.
3. **Details**: everything else, in subsections: how, what does not work and why, alternatives, trade-offs, tests.
4. **Open questions**: a main section of its own, never a subsection of the details.
5. Not used (it was Status; kept free so references to section 6 hold).
6. **As built** (once something is built): what differs from the plan, what was decided during the build, how it
   was tested.

The reader wants the shape of the answer first. Nothing goes between the problem and the brief solution.

## Open questions

- Questions live only in the Open questions section, numbered.
- When the user answers a question: **change the plan itself** (the brief solution, the details, the tests) so it
  reads as if the answer had always been the plan, and **remove the answered question** from Open questions. Do not
  keep a list of answered questions or "Decisions" in the plan; the plan text is the record. Git history keeps the
  questions.
- New questions that come up while revising go into Open questions.
- When none are left, the section says "None."
- Questions you can answer yourself by looking (is a key free, does a function exist) are not questions: check and
  write the fact into the plan.

## Figures

- No invented numbers: no effort estimates, durations, counts or sizes that nothing measured. Write
  `[not yet calculated]` or `[not yet checked]` instead.

## Revising

- Add a line to the Status line's list of changes (`- <date>: revised: <what changed>.`).
- Keep the brief solution in step with the details after every change.

## Executing and closing

- Only when asked. Branch first when on the default branch.
- After each part built: move its row from Not yet built to Built in the Status section, add how it was built and
  tested to As built, set the Status line's state to `partly executed` and add `- <date>: partly executed: <what>.`
- When done (Not yet built empty): state `executed`, add `- <date>: executed.`, move the file to the executed
  folder if the project has one, and fix references to its old path in code comments and docs.
- Foldex: `docs/xplorer2-features.md` is the status of the features it lists. When a plan is written, built or
  closed, update the Foldex column of every row it touches (`plan NN`, `part`, `built`).
- Asked what is left of a plan: its Status section answers; when in doubt, compare each part with the code, correct
  the Status section, and report built / not built per part, without building anything.
