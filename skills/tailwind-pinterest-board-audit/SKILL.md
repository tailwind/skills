---
name: tailwind-pinterest-board-audit
description: Audit how a connected Pinterest account's boards are organized through Tailwind — naming consistency, board list coverage, dead list entries, and publishing timeslots, with optional public group board benchmarks. Use when the user asks for a board audit or wants to review their board setup.
---

# Pinterest board organization audit

This audit reports on how an account's boards are **organized**: what they are
called, which ones are covered by a board list, which list entries point at
boards that no longer exist, and whether a publishing schedule is configured.

It is read-only and consumes no credits.

It says nothing about whether a board is *good*. Board quality, topical
relevance, and performance are not visible here, and inventing them from board
names is the failure mode this audit is written to prevent.

## Gather the data

1. `list_accounts` — resolve the account. Ask which one if there are several.
2. `list_boards` — every board, with `isSecret` and `isCollaborator`.
3. `list_board_lists` — the account's board lists and their ordered entries.
4. `list_timeslots` — the configured publishing schedule.

If `list_board_lists` returns nothing, no board list on the account holds any
boards. That is a valid setup, not a finding on its own — report it as context.
Do not report it as "no board lists configured": a list that exists but holds
no boards is invisible to this endpoint, so an empty result cannot tell the two
apart.

## The checks

Every check below is mechanical. Compute it, report the count, and stop. None
of them requires a judgement about whether a board is worth having.

**Inventory.** Total boards, split by `isSecret` and `isCollaborator`. Secret
boards are private to the user and collaborator boards belong to someone else —
both are worth separating out, because advice that applies to a user's own
public boards often does not apply to either.

**Naming consistency.** Bucket board names by case convention — all lowercase,
Title Case, ALL CAPS, and anything else — and report the counts. A single
dominant convention with a few outliers is worth naming; an even spread is
worth reporting as "no consistent convention". Report the outliers by name so
the user can act.

**Duplicate names.** Report exact duplicates, and names that differ only by
case or whitespace. These are genuinely confusing when picking a board to
publish to, and they are unambiguous to detect.

**Board list coverage.** Boards present in `list_boards` but absent from every
board list. These are boards no grouping publishes to.

**Dead list entries.** Board ids inside a board list that do not appear in
`list_boards`. These point at boards that have been deleted or are no longer
on the account, and they are a known cause of failed Pins — a user cannot see
them from the Pinterest side, which is why this check earns its place.

**Ordering.** Report each list's entries in `order`. Report it verbatim. There
is no correct order to compare against.

**Timeslots.** Total configured slots, and which days of the week have none.
An account with no timeslots at all has no recurring schedule to publish into,
which is a real finding — but do not report it as being unable to schedule
Pins. Scheduling accepts an explicit time regardless of whether any slot
exists. Days with no slots are context, not a defect.

## Optional: public benchmark context

Only when the user supplies target keywords. Call `list_group_boards` with a
keyword and **check `status` before reporting anything**:

- `ready` — report the boards. An empty list means a completed search genuinely
  found no public group boards for that keyword. Say that.
- `warming` — a search is running and nothing is cached yet. Tell the user to
  check back. Do **not** report this as "no group boards found".
- `unavailable` — the search failed. Say the benchmark is unavailable for that
  keyword and continue with the rest of the audit.

These are **other people's public boards**, scraped from Pinterest. They are
context for how boards in a niche are named and sized. They are not the user's
boards, and their board ids cannot be used for scheduling.

The benchmark is optional in the strict sense: the audit must be complete and
useful without it. If the scrape path returns nothing at any keyword, produce
the full API-only report and note that benchmark context was unavailable.

## Report structure

1. **Audit scope and data sources** — the account audited, and which of the two
   sources below each section draws on.
2. **Healthy checks** — what is in good shape.
3. **Findings and recommended actions** — ordered by consequence. Dead list
   entries and no-timeslots come before naming inconsistency.
4. **Public benchmark context** — only when requested and available.
5. **Not available in this audit** — the section below.

Label every claim with its source. Two labels are in play here and they are not
interchangeable:

- **Tailwind account data** — the user's own boards, lists, and timeslots.
- **Public scraped context** — group boards from `list_group_boards`.

A reader must never have to guess whether a number describes their account or
somebody else's. Never merge counts from the two sources into one figure.

## Not available in this audit

Say these explicitly:

- **Board descriptions.** Not exposed for the user's own boards. `list_boards`
  returns id, name, secret, and collaborator status — nothing else.
- **Empty or stale boards.** Pin counts and last-pinned dates are not available
  for the user's own boards, so "this board is empty" and "you haven't pinned
  here in months" cannot be determined. The pin counts in the benchmark section
  are other people's boards and are not a substitute.
- **Actual posting cadence.** Timeslots are the *configured* schedule, not
  observed publishing history. A full slot list does not mean Pins went out.
- **Board lists holding no boards.** `list_board_lists` only returns lists with
  boards in them, so an empty list is indistinguishable from one that was never
  created. Never state that an account has no board lists configured.
- **Private boards of other accounts.** The scrape path sees public boards only.
- **Board-to-keyword relevance.** There is no relevance or quality score here.
  Do not infer one from board names.
- **Performance.** Saves, impressions, clicks, and which boards perform best
  are not available.

When the user asks for one of these, name the gap and stop. Do not answer it
with a proxy — "you have 40 boards and only 12 in a list, so your reach is
probably suffering" is an invented conclusion, and it is the specific failure
this section exists to prevent.
