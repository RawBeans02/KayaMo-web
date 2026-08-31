# Typed actions (intent → service → DB)

Mus reasons. Application services write. Every LLM output stays on a Zod schema.
`requiresConfirmation` stays true until an impact policy allows Undo-only writes.

Shipped today (`packages/ai` `cocoActionNameSchema`):

- create_task, complete_task, create_routine, create_goal, start_focus, log_food, remember_this

Specified next (do not execute via raw SQL). See `csv/actions.csv`.

## To-Do

create_task, edit_task, delete_task, complete_task, schedule_task, move_task,
bulk_update, create_recurring_task, create_project, assign_project

## Timetable

create_block, move_block, resize_block, delete_block,
plan_day, replan_remaining_day, fill_free_time, optimize_day

## Gym (use existing gym services; do not replace the KB)

read_plan, schedule_workout, move_workout, add_exercise, remove_exercise,
replace_exercise, edit_future_sets, start_workout, read_history

## Nutrition

read_remaining_targets, log_food (user-confirmed), suggest_meal
Never write calorie goals.

## Confirmation

Low impact: apply + Undo (add task, complete, note).
Medium: preview (move gym, reschedule, change sets).
High: explicit confirm (delete project, bulk calendar, goal changes).

Audit: who (user|mus), before, after. Universal Undo for Mus writes.
