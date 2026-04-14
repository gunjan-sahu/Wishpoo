# WishPool

Post a wish. Seed it with XLM. Let anyone in the world contribute to making it real.

Each wish lives in a Soroban smart contract — open for contributions until its XLM target is reached. The wisher can claim the pooled funds any time. Every grant is an on-chain transaction.

## Live Links

| | |
|---|---|
| **Frontend** | `https://wishpool-app.vercel.app` |
| **Contract** | `https://stellar.expert/explorer/testnet/contract/CBUVPUKGUFCPJ4L5FBEECGFAY4UCVKCAMZGGDFUSCQ77JBNVYR7R3O2C` |

## How It Works

1. **Make a Wish** — write it, set an XLM target, seed it with an initial amount
2. **Grant** — anyone sends XLM to any open wish
3. **Fulfilled** — auto-marked when pool reaches the target
4. **Claim** — wisher withdraws the pooled XLM any time

## Why This Project Matters

This project turns a familiar real-world workflow into a verifiable on-chain primitive on Stellar: transparent state transitions, user-authenticated actions, and deterministic outcomes.

## Architecture

- **Smart Contract Layer**: Soroban contract enforces business rules, authorization, and state transitions.
- **Client Layer**: React + Vite frontend handles wallet UX, transaction composition, and real-time status views.
- **Wallet/Auth Layer**: Freighter signs every state-changing action so operations are attributable and non-repudiable.
- **Infra Layer**: Stellar Testnet + Soroban RPC for execution; Vercel for frontend hosting.
## Contract Functions

```rust
make_wish(wisher, text, target: i128, seed_amount: i128, xlm_token) -> u64
grant(granter, wish_id, amount: i128, xlm_token)
claim(wisher, wish_id, xlm_token)
get_wish(id) -> Wish
get_recent() -> Vec<u64>
count() -> u64
```

## Stack

| Layer | Tech |
|---|---|
| Contract | Rust + Soroban SDK v22 |
| Network | Stellar Testnet |
| Frontend | React 18 + Vite |
| Wallet | Freighter v1.7.1 |
| Hosting | Vercel |

## Run Locally

```bash
chmod +x scripts/deploy.sh && ./scripts/deploy.sh
cd frontend && npm install && npm run dev
```


