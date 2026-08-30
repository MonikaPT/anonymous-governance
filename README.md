# Anonymous Governance

A privacy-preserving governance/voting dApp built on the Midnight
blockchain (preprod network). Community members can create proposals,
vote yes/no, and close proposals to reveal a final tallied outcome —
without any individual vote being tied to a voter's identity in the
governance ledger.

## What it does
- **Create proposals** — any connected wallet can submit a proposal for
  the community to vote on.
- **Vote anonymously** — yes/no votes are recorded via Midnight's
  privacy-preserving zero-knowledge infrastructure. Individual votes are
  not associated with a voter identity in the on-chain ledger state.
- **Close & reveal results** — the proposal creator can close voting,
  which reveals a final result (Approved / Rejected / Tied) based on the
  yes/no tally.
- **Governance history** — closed proposals and their outcomes are kept
  visible in a history list, instead of disappearing once closed.

## Why Midnight
Midnight's zero-knowledge contract model lets us separate "what happened"
(a vote was cast, a proposal passed) from "who did it." The same
privacy pattern used here for governance voting could be extended to
other sensitive use cases — for example, confidential workplace
misconduct reporting, where people need a verifiable way to be heard
without being identified.

## Tech stack
- **Contract**: Compact language, compiled with the Midnight `compact`
  compiler
- **Frontend**: React + TypeScript + Vite, MUI components
- **Wallet integration**: Midnight DApp Connector API
- **Network**: Midnight preprod

## Running locally

1. Install dependencies:
```bash
   npm install
   cd api && npm install && cd ..
   cd contract && npm install
   npm run compact
   npm run build && cd ..
   cd bboard-cli && npm install && npm run build && cd ..
   cd bboard-ui && npm install && cd ..
```

2. Start a local proof server (requires Docker):
```bash
   docker run -d -p 6300:6300 -e PORT=6300 midnightntwrk/proof-server:8.1.0
```
   Verify it's healthy: `curl http://localhost:6300`

3. Build and serve the frontend:
```bash
   cd bboard-ui
   npm run build
   npm run build:start
```
   Open the printed local URL (e.g. `http://127.0.0.1:8080`) in Chrome.

## Wallet setup (important)

**Use the [1AM wallet](https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp) browser extension.**
We initially built and tested with Lace, but hit a persistent bug where
Lace's "Authorize" popup would not register clicks — reproducible even
in a fresh Incognito profile with a clean install. Switching to 1AM
resolved this immediately with no other changes needed.

1. Install 1AM and create a wallet.
2. In Settings → General → Network Environment, select **Preprod**, then
   Apply and Resync.
3. Fund your wallet from the preprod faucet:
   https://faucet.preprod.midnight.network/
4. Generate DUST from your NIGHT balance inside 1AM ("Your Dust" panel).
5. Connect to the app when prompted — approve the connection request.

## Known Limitations & Future Work

- **One-vote-per-participant is not yet enforced.** The `voteYes` /
  `voteNo` circuits currently increment a global counter without
  tracking per-voter eligibility, so the contract does not yet guarantee
  Sybil resistance. A production version would add a private nullifier
  set to these circuits so each eligible participant can vote exactly
  once, while still preserving voter anonymity.
- **Proposal closing is manual**, triggered by the proposal creator,
  rather than deadline-based. A time-bound voting window (e.g. "ends in
  24h") would make the governance mechanism feel more realistic and
  would be a natural next contract change.
- **Single active proposal at a time.** Supporting multiple concurrent
  proposals would better fit real governance/DAO use cases.
- **Proposal categories, quorum thresholds, and delegated voting** are
  natural extensions once the above foundations are in place.

## Privacy note

Proposal creation uses a witness-derived key (`localSecretKey` +
`publicKey` circuit) so a creator can prove ownership of a proposal
without exposing their raw secret key on-chain. Votes are recorded as
aggregate counters with no voter-identity field in the ledger state —
so while the current contract is not yet Sybil-resistant (see
Limitations above), it does not publicly associate any wallet identity
with an individual vote.
