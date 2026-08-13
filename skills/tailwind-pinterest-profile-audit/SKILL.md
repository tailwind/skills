---
name: tailwind-pinterest-profile-audit
description: Audit the health of a connected Pinterest account's profile through Tailwind — authorization, domain verification, and profile completeness. Use when the user asks for a profile audit, an account checkup, or why their account may not be publishing.
---

# Pinterest profile health audit

This audit reports on the profile fields Tailwind can verify directly for a
connected Pinterest account. It is read-only: it consumes no credits, creates
nothing, and changes nothing.

It is also narrow, and the narrowness is the point. Users asking for an
"account audit" usually want to know why their impressions are low. That
question cannot be answered from this data, and guessing at it from the fields
below produces confident advice built on nothing. Report what the checks show,
then say plainly what this audit cannot see.

## Run the checks

Call `list_accounts`. Every field this audit reports comes from that one call.

If the user has more than one connected account and hasn't said which, ask
rather than auditing all of them — a report about the wrong profile reads as
authoritative and wastes the user's time acting on it.

Check each field below. A field that is present and non-empty is a healthy
check; a field that is missing or false is a finding.

| Field | Healthy | Finding means | User action |
| --- | --- | --- | --- |
| `tokenAuthorized` | `true` | Tailwind cannot publish to this account at all. Nothing else in this report matters until it is fixed. | Reconnect the Pinterest account from the Tailwind dashboard. |
| `isDomainVerified` | `true` | Tailwind has no verified website domain for this account. | Claim the website on Pinterest, then reconnect in Tailwind so the status refreshes. |
| `avatarUrl` | non-null | No profile image. | Add a profile photo on Pinterest. |
| `username` | non-null | No Pinterest username on record — usually a legacy connection. | Reconnect the account so Tailwind picks up the username. |

`createdAt` is context, not a check. A recently connected account has little
history behind it, which is worth saying when the user is asking why they see
no results yet. Never report it as a problem.

`displayName` is not checkable and must never be reported as a finding. The
API falls back to the Pinterest username when an account has no name set, so
the field is non-empty for an account with no display name just as it is for
one with a display name — the two are indistinguishable from this response.
Claiming a display name is present would be as wrong as claiming it is
missing, so say nothing about it either way.

Order findings by consequence, not by the order above: an unauthorized token
stops publishing outright, a missing profile image does not.

## The domain verification trap

`isDomainVerified` is Tailwind's own record, and users regularly report that
Pinterest shows their site as verified while Tailwind shows it missing. When
you report this finding, say that it reflects what Tailwind has recorded, and
that a reconnect is what refreshes it. Do not tell the user their site is
unverified on Pinterest — you cannot see Pinterest's side of it.

`tokenAuthorized` is resolved live from Pinterest at request time, so it is
trustworthy in a way the stored fields are not. One consequence worth knowing:
during a Tailwind service degradation every account can report `false` at once.
If every account in a multi-account org looks unauthorized simultaneously,
treat that as suspect and say so rather than telling the user to reconnect all
of them.

## Report structure

Use these sections, in this order:

1. **Audit scope and data sources** — name the account audited, and state that
   every finding comes from Tailwind account data.
2. **Healthy checks** — the fields that passed. Say them; a report that lists
   only problems reads as a broken account.
3. **Findings and recommended actions** — one entry per finding, each with the
   user action from the table.
4. **Not available in this audit** — the section below.

Label every finding as **Tailwind account data**. This audit has no other
source. That labelling matters because the board audit does mix sources, and a
user reading both should be able to tell where each claim came from.

## Not available in this audit

State these explicitly rather than leaving them unmentioned — an unmentioned
gap reads as a clean bill of health:

- **Performance of any kind.** Impressions, saves, outbound clicks, follower
  counts, and profile visits are not exposed here. If the user asked why their
  numbers are low, this audit cannot answer that.
- **Profile content quality.** Bio text, board cover imagery, and whether the
  profile reads well for a niche are not visible.
- **Pinterest-side account standing.** Whether the account is in good standing,
  rate-limited, or has had content flagged is not visible.
- **Whether Pins are being distributed.** Nothing here reports how Pinterest is
  treating the account's content.

Do not substitute a proxy for any of these. "You have no profile image, which
is probably why your impressions are low" is exactly the kind of invented
causation this audit exists to avoid.
