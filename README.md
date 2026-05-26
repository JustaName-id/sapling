# Sapling

Give out subnames under your `.eth` name. No code required.

If you own `alice.eth`, Sapling lets you mint subnames like `bob.alice.eth`, `cafe.alice.eth`, or open it up so other people can claim their own. The subnames live on Ethereum, resolve everywhere ENS works, and the contracts behind them are yours to control.

## How it works

1. Connect your wallet.
2. Pick a `.eth` name you own.
3. Decide who can mint subnames under it (open to anyone, paid, or allowlisted).
4. Sign one batched transaction.

That's the whole flow. After it confirms, you have your own subname namespace.

## What gets deployed

ENSv2 makes every name hierarchical: each name has a slot pointing at the contract that manages its children. Sapling installs two small contracts and wires them into your parent name's slot:

- a **UserRegistry** that tracks who owns each subname under your name
- a **Registrar** (Open, Paid, or Allowlist) that decides how new ones get minted


## Layout

```
contracts/   Solidity. SaplingFactory + registrar templates.
web/         Next.js app. The deploy flow.
```

## Run it locally

```
cd contracts && forge test
cd web       && npm install && npm run dev
```

## Status

Pre-audit. Sepolia only for now.
