# Sapling

A no-code way to issue **subnames under ENSv2**.

If you own `alice.eth`, Sapling sets up everything your name needs to mint subnames like `bob.alice.eth`, `cafe.alice.eth`, or let other people claim their own. It deploys the contracts behind your name and walks you through the config along the way: who can mint (just you, paying users, an allowlist), what address controls the registry, whether it stays upgradeable, and whether to reuse contracts you already have. The subnames live on Ethereum, resolve everywhere ENS works, and the contracts behind them are yours to control.

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

## Bring your own contracts

Every step has an escape hatch if you'd rather not let Sapling deploy for you:

- **Already wired** — if your `.eth` already points at a UserRegistry, Sapling detects it and offers to reuse it instead of replacing it.
- **Custom UserRegistry** — fork [UserRegistry.sol](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/UserRegistry.sol) (your own storage, roles, upgrade logic), deploy it, and paste the address. Sapling skips the deploy step and just wires it under your name.
- **Custom Registrar** — inherit from [SaplingRegistrarBase.sol](https://github.com/JustaName-id/sapling/blob/main/contracts/src/base/SaplingRegistrarBase.sol) and ship any minting policy you want (signature-gated, passkey, NFT-gated, etc.). [OpenRegistrar.sol](https://github.com/JustaName-id/sapling/blob/main/contracts/src/registrars/OpenRegistrar.sol) is the reference template to copy from.

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
