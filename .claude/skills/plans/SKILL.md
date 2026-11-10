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

1. **What the plan is about**: the defect or the enhancement.
2. **The solution, in brief**: a few lines at most, prose only. No code, no SQL, no examples, no options table, no
   rejected alternatives.
3. **Details**: everything else, in subsections: how, what does not work and why, alternatives, trade-offs, tests.
4. **Open questions**: a main section of its own (usually section 4), never a subsection of the details.
5. **As built** (only once executed): what differs from the plan, what was decided during the build, how it was
   tested.

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

- Update the Status line (e.g. "draft <date>, revised <date>; not started").
- Keep the brief solution in step with the details after every change.

## Executing and closing

- Only when asked. Branch first when on the default branch.
- When done: Status "executed (<date>); see As built", add the As built section, move the file to the executed
  folder if the project has one, and fix references to its old path in code comments and docs.
- Asked what is left of a plan: compare each part of the plan with the code and report built / not built per part,
  without building anything.
