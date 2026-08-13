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

## Get the copy right before you create anything

There is no tool to edit a Pin once it exists. `schedule_post` changes only the
time and the Board; `create_post` always makes a *new* Pin. So a draft with the
wrong title, description, media, or destination URL cannot be corrected through
these tools — the only route is `delete_post` and start again.

Confirm the copy and the media with the user **before** calling `create_post`.
Do not save a rough draft intending to refine it later.

The Board is the exception, and the one thing you can safely defer: `boardId`
can be supplied later when you call `schedule_post`.

`create_post` without `sendAt` saves a draft, which is right when the timing is
undecided but the content is settled. Adding `sendAt` schedules it, and makes
`title`, `description`, `url`, and `boardId` all mandatory. `schedule_post`
moves an existing draft or queued Pin to a time and expects `title`,
`description`, and `url` to already be set.

After scheduling, confirm it landed with `list_posts` using `status: "queued"`
rather than assuming success from the tool's response text.

`sendAt` is ISO 8601 and must be in the future. Ask the user for their intended
time and time zone instead of inventing one.

## Scheduling spends the user's credits

Moving a Pin to scheduled consumes a Pin-scheduling credit from the user's plan.
Saving a draft does not, and rescheduling an already-queued Pin is not charged
again.

Two consequences worth respecting: don't schedule speculatively to "see if it
works" — create a draft instead. And if a call comes back as a payment-required
error, that is a real billing outcome (out of credits, trial exhausted, or no
plan access), not a transient failure to retry. Tell the user what happened
rather than trying again.

## When something fails

- **Rejected board ID** — you almost certainly passed a name or URL. Call
  `list_boards` and use an ID from the response.
- **Missing required field on a scheduled Pin** — `title`, `description`, `url`,
  and `boardId` are only required once `sendAt` is present. Either supply them or
  save a draft instead.
- **`delete_post` fails** — it only works on Pins that have not published yet.
  Published Pins have to be removed from Pinterest directly.
