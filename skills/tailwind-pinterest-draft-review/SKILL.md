---
name: tailwind-pinterest-draft-review
description: Review the Pinterest Pin drafts that Tailwind's AI generated — from a URL generation or a connected feed — against the user's own criteria, then schedule the good ones, fix the nearly-right ones, and discard the rest. Use when the user asks to review, approve, clear out, or publish their generated, AI-drafted, or SmartPin drafts, or to run that review on a schedule.
---

# Reviewing Tailwind's generated Pin drafts

A Pin that Tailwind's AI generates, from `generate_pins_from_url` or a
connected feed, is saved as a draft. It never publishes on its own: someone
has to look at it and either schedule it or discard it, and most people never
come back to do that, so generated Pins sit unpublished and the credits that
made them are wasted. This playbook is that review, done by you against the
criteria the user gives.

The tools' own descriptions cover their parameters. This file covers what
they cannot: the traps where a correct-looking review run still goes wrong.
The long-form version, with REST equivalents, is at
https://api-docs.tailwind.ai/guides/reviewing-generated-drafts.

## The criteria are the user's, not yours

Tailwind stores no review criteria and applies none of its own. The criteria
come from the user's request or from standing instructions they have given
you. If you have neither, ask before judging anything. Do not invent a
standard from the drafts themselves: a review that approves whatever looks
fine to you is not the review the user asked for, and scheduling spends
their credits.

Do not tell the user to write their criteria into this file. The installer
rewrites it on every run and plugin updates replace it, so anything stored
here is lost on the next upgrade. Their own instructions or project notes
are the right home.

## A review is not permission to act

"Review my drafts" asks for judgements, not for Pins on the schedule or in
the bin. Unless the user's request or their standing instructions say to
schedule what passes and delete what fails, stop after judging: report what
you would approve, fix, and discard, with the reason for each, and let the
user say which to apply. Scheduling spends their credits and deletion cannot
be undone, so neither is a side effect of being asked to look.

A run with no one watching, from a scheduled task or a cron, is the case to
be strict about. It can act only on a standing instruction that names the
actions: "schedule the ones that pass and delete the ones that fail". A
standing instruction that only gives criteria licenses the report, not the
changes.

## Find the drafts

Call `list_accounts` first and use a numeric account ID from it. If there is
more than one account and the user has not said which, ask.

Then `list_posts` with `status: "draft"` and `limit: 100`, and follow
`cursor` until a response comes back without one. Every draft assigned to
the account lists here, hand-made ones included. The generated ones carry a
`generationId`, and in the result text their line starts with `Generated`.
Those are the only drafts this review touches. A draft with no
`generationId` was made by hand, or through the API, and is left exactly as
it is: never scheduled, edited, or deleted by this workflow unless the user
asks for that separately.

A generated draft is "unreviewed" only in the sense that it is still a draft.
Tailwind keeps no record that a draft was looked at. Once it is scheduled or
deleted it leaves the list; until then it stays, however many times it has
been considered.

Drafts not yet assigned to any Pinterest account, such as some Made For You
drafts, do not list. The Pin Scheduler in the dashboard counts them in a
"drafts that aren't assigned to a Pinterest account yet" banner, and the
user assigns them from there. So the draft count here can be lower than the
dashboard's by that number. That is expected, not missing drafts, but a
larger gap is worth reporting.

## Judge each one

Each draft carries its title, description, destination link (`url`) and
image (`mediaUrl`). Compare those with the criteria. Three outcomes: approve
as is, fix then approve, or discard.

To see the picture, call `get_post_image` with the draft's `postId`. Not
every client passes the image on to the model. If it did not arrive, say so,
judge on the copy and link only, and never describe what the picture
"probably" shows. A criterion about the image that you cannot check is a
draft to leave for the user, not one to approve.

A draft you are unsure about is left where it is. It stays in the list and
comes up again next time. Leaving a draft is always safe; the other two
decisions are not.

## Fix the nearly-right ones

Copy and placement are edited in place with `update_post`, which is free.
Only the fields you send change. Fix a title, description, link, Board or
Board section this way rather than deleting and recreating the Pin, which
would throw away the generated design.

The picture is a separate surface. For a generated draft, call
`get_pin_design` and follow the `supportedOperations` it reports; the
operations differ by design tier, and calling one the Pin does not support
is rejected. `update_pin_design` re-renders a template design with a new
overlay title, colors or image for free, and `select_pin_design_variation`
switches to a design Tailwind already has, also free. The design read lists
the other pictures Tailwind found on the source page, so a wrong photo is
usually a free swap. `regenerate_pin_design` has the AI design a new one for
about 7 credits, runs asynchronously, and produces a variation you still
have to apply with `select_pin_design_variation`. Ask before spending that;
a review the user expected to be free should not come back having bought
new designs.

## Approve the good ones

Approving a draft is scheduling it. Call `schedule_post` with
`useNextOpenSlot: true`. That claims the account's next open smart schedule
slot and applies the account's Pin Spacing rules for the Pin's link. Never
compute a `sendAt` from `list_timeslots` or `get_schedule`: a slot that
reads as open can already be taken, and `sendAt` ignores Pin Spacing, so
approved Pins stack up off-schedule. A draft without a Board also needs
`boardId` on that call, a numeric ID from `list_boards`.

Scheduling is the charged step. On modular-billing accounts it spends one
Pin credit per draft (free on winback plans; a free-trial allowance where
the account has no Publishing access), and legacy and Shopify accounts count
it against the plan's post limit instead. Check `get_account_usage` before
a large batch. A payment-required error is a real billing outcome, not a
transient failure: stop scheduling, tell the user how many drafts remain,
and do not retry.

After the batch, confirm it landed with `list_posts` using
`status: "queued"` rather than trusting the response text alone.

## Discard the rest

A draft that fails the criteria and is not worth fixing is deleted with
`delete_post`. Deletion cannot be undone. It is also what keeps the next run
from judging the same draft again, so a draft you discard should be one the
criteria clearly reject, not one you were on the fence about. On the fence
means leave it.

## Running it again

Nothing in Tailwind starts the next run; the user does, or a scheduled task
in your own client does. The workflow is safe to repeat for the drafts it
decided: an approved draft leaves the list when scheduled and a discarded
one when deleted, so a later run only sees what was left.

Two runs that overlap can both try to schedule the same draft. The second
`schedule_post` then fails with a conflict, because the draft is no longer a
draft, and nothing is charged for the failed call. Treat that conflict as
"already decided": re-list before acting on anything else from the stale
page, and do not retry it. Overlap is still worth avoiding, since each run
reads the whole list; give a scheduled task an interval longer than a run
takes.

One trap. A generated Pin that was approved and later taken off the schedule
with `unschedule_post` returns to the draft list with its `generationId`,
and nothing marks it as already reviewed. The next run judges it again and
may schedule or delete it. If the user held a Pin back on purpose, they need
to tell you which one, or expect it to be decided by the criteria again.

## Report what you did

List each draft by title and `postId` under four headings: approved, fixed
then approved, discarded, and left for the user. Say what each fix changed
and why each discard failed the criteria. Say how many hand-made drafts
were skipped, so the user knows the list was read in full. If any picture
could not be seen, say so once rather than per draft.

## Not available in this review

Say these explicitly when they matter:

- **Whether a draft was reviewed before.** Tailwind keeps no record, so a
  draft in the list is one that was never decided, or one that was decided
  and unscheduled; the two look the same.
- **The criteria.** Tailwind has none to read back. If the user asks what
  standard their drafts were judged by, the answer is whatever they gave
  you, and nothing else.
- **How the draft will perform.** Nothing in a draft predicts saves or
  clicks. `get_account_analytics` and `list_top_pins` describe what already
  published Pins did, which can inform the user's criteria but is not a
  judgement on a draft.
- **The picture, in some clients.** See above. A review that could not see
  the images is a review of the copy, and the report should say so.
