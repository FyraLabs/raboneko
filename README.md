# raboneko

Fyra Labs' neko assistant.

## Installation

```sh
deno ci
deno task migrate
deno task generate
deno task sync
deno task start
```

`deno task migrate` applies pending Prisma migrations to the configured
database. Set `DATABASE_URL` before running it.

## Progress reminders

See the [progress reminder setup guide](docs/progress-reminders.md) for
deployment, webhooks, and staff instructions.
