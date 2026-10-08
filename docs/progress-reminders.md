# Progress reminders for staff

This guide covers deployment and staff setup for Raboneko's progress reminder
feature.

## How reminders work

The bot sends a progress reminder DM to members of the configured staff role,
once per local calendar day, at each member's configured time (default: **17:00
America/Chicago**, Central Time with daylight-saving changes).

- Staff who opt in receive a progress reminder every day, whether or not they
  contributed on GitHub.
- Staff who opt out still receive a progress reminder on a day when their linked
  GitHub account has qualifying activity in a supported organization.
- A qualifying webhook event before the configured time is included in the
  scheduled reminder. If activity happens after that time, the bot checks
  webhook activity each minute and sends the reminder then.
- The GitHub public events API is a fallback and is checked hourly after the
  configured time. It does not reliably expose private repository activity;
  organization webhooks are required to cover private repositories.
- Activity webhook records are pruned after 48 hours.

Qualifying event types are pushes, pull requests, pull request reviews and
review comments, issues and issue comments, commit comments, repository creates,
and releases.

## Deployment setup

### 1. Configure environment variables

Set the following values in the bot's runtime environment:

| Variable                | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `PRIMARY_GUILD_ID`      | Discord server where the staff role is checked                 |
| `STAFF_ROLE_ID`         | Discord role whose members receive reminders                   |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify GitHub webhook signatures         |
| `GITHUB_ORGANIZATIONS`  | Optional comma-separated GitHub organization logins to monitor |
| `HEALTH_PORT`           | Port for the bot's HTTP health endpoint and webhook receiver   |
| `DATABASE_URL`          | PostgreSQL connection string, also required for migrations     |

`GITHUB_TOKEN` is optional and can be provided for the GitHub API fallback,
subject to GitHub's API visibility and rate limits. It does **not** replace
webhooks for private-repository activity.

The bot needs its existing Redis configuration for BullMQ scheduling. The bot's
Discord application must have the **Server Members Intent** enabled, because the
bot checks whether a user currently has the configured staff role.

### 2. Apply the database migration and sync commands

With `DATABASE_URL` set, deploy the database migration and generate the Prisma
client:

```sh
deno task migrate
deno task generate
deno task sync
```

Then restart/deploy the bot. The recurring reminder worker uses the existing
BullMQ/Redis infrastructure.

### 3. Configure organization webhooks

By default, the bot monitors these GitHub organizations:

- `FyraLabs`
- `FyraStack`
- `Ultramarine-Linux`
- `terrapkg`

To change the monitored organizations, set `GITHUB_ORGANIZATIONS` to a
comma-separated list of GitHub organization logins, for example:

```sh
GITHUB_ORGANIZATIONS=FyraLabs,terrapkg
```

The same list is used for webhook filtering and the public GitHub events API
fallback. If the variable is unset or blank, the default organizations above are
used. After changing it, restart the bot and configure an organization webhook
in each organization in the resulting list.

Use these settings for each webhook:

- **Payload URL:** `https://<public-bot-host>/github/webhook`
- **Content type:** `application/json`
- **Secret:** the value of `GITHUB_WEBHOOK_SECRET`
- **Events:** pushes, pull requests, pull request reviews, pull request review
  comments, issues, issue comments, commit comments, create, and release

The endpoint must be reachable over HTTPS through the bot's `HEALTH_PORT` (or a
reverse proxy that forwards to it). The proxy must pass the request body through
unchanged so the GitHub SHA-256 signature can be validated. Configure the same
secret in each organization webhook and the bot environment.

The endpoint returns `202` for accepted or ignored deliveries. A missing secret
returns `503`; an invalid or missing signature returns `401`. GitHub delivery
IDs are used to deduplicate webhook retries.

> **Private repositories:** organization webhooks are necessary for dependable
> activity detection in private repositories. If webhooks are not configured or
> cannot reach the bot, the public API fallback may still detect some public
> activity but cannot guarantee mandatory reminders.

## Staff setup and commands

Commands are available only in the primary server and only to members of
`STAFF_ROLE_ID`.

1. Link your GitHub account:

   ```text
   /progress-reminder github username:<github-username>
   ```

   Usernames are case-insensitive. Each GitHub username can be linked to one
   Discord account. Linking is required for contribution-based reminders; it is
   not required for opt-in reminders.

2. Choose a time and, optionally, a timezone:

   ```text
   /progress-reminder time time:17:30 timezone:America/Los_Angeles
   /progress-reminder time time:5:30 PM timezone:America/Los_Angeles
   ```

   Time accepts 24-hour `HH:MM` or 12-hour `h:mm AM/PM` input. It is stored in
   24-hour format. Timezones must be valid IANA names, such as `Europe/London`
   or `America/Los_Angeles`. If timezone is omitted, the current timezone is
   retained; new settings default to `America/Chicago`. Existing saved timezones
   are preserved when this default changes.

   Reminder confirmations and status display North American abbreviations with
   their current UTC offset, such as `CDT (UTC-05:00; America/Chicago)`. Other
   zones display as an offset and IANA name, such as `UTC+02:00 (Europe/Paris)`.
   The abbreviation and offset adjust for daylight-saving time.

3. Optionally enable progress reminders every day:

   ```text
   /progress-reminder opt-in
   ```

   To stop opted-in progress reminders:

   ```text
   /progress-reminder opt-out
   ```

   Opting out does not turn off contribution-triggered progress reminders.

4. Check the current settings at any time:

   ```text
   /progress-reminder status
   ```

The DM asks the staff member to submit a progress update with
`/progress create`. They need to allow DMs from the bot/server to receive it.

## Troubleshooting

- **The command says it is only for staff:** check `PRIMARY_GUILD_ID`,
  `STAFF_ROLE_ID`, the command's server, and that the user currently has that
  role.
- **No contribution-based progress reminder:** verify the staff member linked
  the correct GitHub username, the event is one of the qualifying types, and the
  repository belongs to an organization in `GITHUB_ORGANIZATIONS` (or the
  default list). For private activity, verify the organization webhook's URL,
  event subscriptions, and secret.
- **Webhook returns `401`:** the webhook secret does not match, the signature
  header is missing, or a proxy modified the request body.
- **Webhook returns `503`:** `GITHUB_WEBHOOK_SECRET` is not set in the running
  bot environment.
- **A DM is not delivered:** confirm the member permits direct messages from the
  bot/server and check the bot logs for delivery errors.
- **No reminders run:** verify Redis and the bot's database connection are
  healthy and that the migration has been applied.
