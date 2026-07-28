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

Board IDs come from the boards resource:

```
tailwind://accounts/<accountId>/boards
```

Two things to get right:

**Substitute the real account ID.** The server advertises this resource with a
literal placeholder in the URI (`tailwind://accounts/{accountId}/boards`).
Reading that string verbatim will not return the user's Boards — replace the
placeholder with the actual numeric account ID before reading.

**If you cannot read MCP resources, ask the user.** Not every client supports
reading MCP resources on the agent's own initiative. If resource reads are
unavailable to you, or the read fails, ask the user for the board ID rather than
guessing one or passing a Board name. There is currently no tool that lists
Boards, so asking is the correct fallback, not a workaround to avoid.

## Draft first, then schedule, then verify

`create_post` without `sendAt` saves a draft. That is the safe default when
anything is still unconfirmed — the media, the copy, or the Board.

Adding `sendAt` schedules the Pin, and scheduling is what makes the extra fields
mandatory: `title`, `description`, `url`, and `boardId` must all be present.
`schedule_post` moves an existing draft or queued post to a time, and expects
`title`, `description`, and `url` to already be set.

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

- **Rejected board ID** — you almost certainly passed a name or URL. Re-read the
  boards resource with the account ID substituted in.
- **Missing required field on a scheduled Pin** — `title`, `description`, `url`,
  and `boardId` are only required once `sendAt` is present. Either supply them or
  save a draft instead.
- **`delete_post` fails** — it only works on Pins that have not published yet.
  Published Pins have to be removed from Pinterest directly.
