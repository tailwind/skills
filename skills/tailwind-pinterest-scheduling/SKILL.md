---
name: tailwind-pinterest-scheduling
description: Create, schedule, and review Pinterest Pins through Tailwind. Use when the user wants to schedule Pins, pick a Pinterest Board, manage drafts, or check what is queued to publish.
---

# Scheduling Pinterest Pins with Tailwind

The Tailwind MCP server creates and schedules Pinterest Pins on the user's
behalf. Each tool's own description covers its parameters. This file covers the
things the tools cannot tell you — the places where a correct-looking call still
fails.

## Start by resolving the account

Every tool takes an `accountId`, and it is Tailwind's numeric account ID, not a
Pinterest username or profile URL. Call `list_accounts` first and use an ID from
the response. If the user has more than one account and hasn't said which,
ask — publishing to the wrong Pinterest profile is not something you can undo
from here.

## Board IDs are where this usually goes wrong

Scheduling requires `boardId`, and it must be the **numeric board ID as a
string** — for example `"1106196864631757445"`. A Board name, a Pinterest URL,
or a slug will be rejected.

Board IDs come from `list_boards`, which takes the account ID and returns each
Board's numeric ID and name. Call it rather than asking the user to find an ID
by hand.

The same data is also published as a resource:

```
tailwind://accounts/<accountId>/boards
```

If you read it that way, substitute the real account ID — the server advertises
the URI with a literal `{accountId}` placeholder, and reading that string
verbatim will not return the user's Boards. `list_boards` needs no such care,
which is why it is the better route.

## Board sections and several Boards at once

To publish into a section of a Board, pass `boardSectionId` alongside
`boardId`. Section IDs come from `list_board_sections`. A section only belongs
to its own Board, so moving a Pin with `boardId` alone clears whatever section
it was in.

To put one Pin on several Boards, pass `intervalBoards` (in publishing order)
plus `intervalType` in place of `boardId`, on a single scheduled `create_post`
call. Tailwind spaces the Boards out over time. Calling `create_post` once per
Board instead publishes them all at once. Each Board becomes its own scheduled
Pin and is charged like any other scheduled Pin (see credits below).

## Drafts, scheduling, and editing

A `create_post` call that omits both `sendAt` and `useNextOpenSlot` saves a
draft, which is right when the timing is undecided. To schedule in the same
call, pass **exactly one** of them, plus `title`, `description`, `url`, and
`boardId` (or `intervalBoards`). `schedule_post` puts an existing draft or
queued Pin on the schedule with the same one-of choice, and expects `title`,
`description`, and `url` to already be set. A draft saved without a Board also
needs `boardId` on that `schedule_post` call.

Prefer `useNextOpenSlot: true` unless the user named a specific time. It takes
the account's next open smart schedule slot and applies the account's Pin
Spacing rules for the destination URL, which a timestamp you invent cannot.
Never compute a `sendAt` from `list_timeslots`. Reserve `sendAt` for a time the
user actually asked for. It must be a future UTC instant ending in `Z`, such as
`2026-01-15T15:00:00Z`: a local-offset time like `2026-01-15T09:00:00-06:00` is
rejected as an invalid datetime, so convert the user's local time to UTC first.

An explicit `sendAt` only sets the Pin's first publish time. It is not an
exemption from Pin Spacing: a later respace or schedule shuffle can still move
the Pin, and no tool can lock it in place. To see how far apart Pins to a URL
will land, call `get_pin_spacing_rule` with that URL, or
`list_pin_spacing_rules` for every rule on the account. The rules themselves
can only be changed in the Tailwind dashboard.

After scheduling, confirm it landed with `list_posts` using `status: "queued"`
rather than assuming success from the tool's response text.

To fix a draft or queued Pin's title, description, link, Board, section, alt
text, or product tags, use `update_post`. It is free and never changes when the
Pin publishes. Do not delete and recreate a Pin to fix a typo. The image is the
exception: `update_post` cannot change it, so a new image means `delete_post`
plus a fresh `create_post`. Pins that Tailwind's AI designed have their own
design tools, starting with `get_pin_design`. Published Pins can't be edited
through Tailwind at all.

## Scheduling spends the user's credits

On modular-billing accounts, moving a Pin to scheduled consumes a Pin credit
(or free-trial allowance). Winback plans schedule free, and legacy and Shopify
accounts spend no credits; each Pin counts against their plan's post limit
instead. Saving a draft is always free, and rescheduling an already-queued Pin
is not charged again.

Two consequences worth respecting: don't schedule speculatively to "see if it
works" — create a draft instead. And if a call comes back as a payment-required
error, that is a real billing outcome (out of credits, trial exhausted, or no
plan access), not a transient failure to retry. Tell the user what happened
rather than trying again.

## When something fails

- **Rejected board ID** — you almost certainly passed a name or URL. Call
  `list_boards` and use an ID from the response.
- **Missing required field on a scheduled Pin** — `title`, `description`, `url`,
  and a Board are required once `sendAt` or `useNextOpenSlot` is present. Either
  supply them, or drop both timing fields to save a draft instead.
- **`intervalBoards` rejected** — it also needs `intervalType` and one of
  `sendAt` or `useNextOpenSlot`, and it can't be combined with `boardId`. A draft
  can't use it: to save a draft, pass a single `boardId` or no Board at all.
- **`delete_post` fails** — it only works on Pins that have not published yet.
  Published Pins have to be removed from Pinterest directly.
