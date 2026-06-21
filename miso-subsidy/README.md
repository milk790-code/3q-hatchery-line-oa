# Miso and subsidy intake pages

Publish target: GitHub Pages for `3q-hatchery-line-oa`.

## Files

- `/pay/3q-starter.html` - static 3Q starter payment bridge.
- `/miso-subsidy/miso-b2b-inquiry.html` - Miso B2B inquiry form.
- `/miso-subsidy/subsidy-matching-intake.html` - subsidy matching intake form.

## Runtime dependency

The two intake pages post to:

```text
https://cdg-core-eyes.milk790.workers.dev/api/intake
```

The payment bridge uses:

```text
https://cdg-core-eyes.milk790.workers.dev/api/checkout
```

## Human gates

- Do not use the payment bridge for hot-lead LINE pushes until `cdg-core-eyes /health` reports ECPay and EYES secrets as true.
- Push, PR creation, merge, and public GitHub Pages publication require explicit human approval.
- Run the payment readiness script after publication:

```zsh
/Users/mac/Documents/Codex/scripts/3q-payment/verify-payment-readiness.command
```

## Expected public URLs

```text
https://milk790-code.github.io/3q-hatchery-line-oa/pay/3q-starter.html
https://milk790-code.github.io/3q-hatchery-line-oa/miso-subsidy/miso-b2b-inquiry.html
https://milk790-code.github.io/3q-hatchery-line-oa/miso-subsidy/subsidy-matching-intake.html
```
