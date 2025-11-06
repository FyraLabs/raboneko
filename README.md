# raboneko

Fyra Labs' neko assistant.

## Installation

```sh
pnpx slash-up sync
pnpm build
pnpm start
```

## LLM Setup

Raboneko uses Cloudflare's Workers AI to provide LLM functionality.

1. Create an AI gateway in your Cloudflare account.
2. Create an API token with the following permissions:
   - Account - Workers AI - Read
   - Account - Workers AI - Write
   - Account - AI Gateway - Run
3. Set the following environment variables in your `.env` file:
    - `CLOUDFLARE_API_KEY`: Your Cloudflare API token.
    - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID.
    - `CLOUDFLARE_AI_GATEWAY_ID`: The ID of your AI gateway.
    - `LLM_ROLE_ID`: The role ID that is allowed to use LLM features
