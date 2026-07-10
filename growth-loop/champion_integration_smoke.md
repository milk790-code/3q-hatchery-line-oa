# Champion Integration Smoke

BLUF: PASS. The 3Q champion candidate and Growth Loop collector were tested together on localhost with an isolated D1. No production, public-link, GitHub, LINE, customer-data, payment, or delete action occurred.

Generated: 2026-07-10T21:46:51.748Z
Mode: isolated_local_champion_integration_smoke

## Candidate Page

| check | result |
|---|---|
| response_ok | pass |
| html_no_store | pass |
| false_success_state_absent | pass |
| personal_input_controls_absent | pass |
| line_only_mode_present | pass |
| line_url_present | pass |
| telemetry_script_present | pass |
| collector_url_injected | pass |
| credentials_omitted | pass |
| accurate_telemetry_disclosure | pass |
| attribution_persisted | pass |
| client_token_sanitizer_present | pass |
| client_embedded_pii_guard_present | pass |
| allowed_campaign_preserved | pass |
| foreign_phone_campaign_rejected | pass |
| client_uuid_session_guard_present | pass |
| non_crypto_random_fallback_absent | pass |
| build_marker_present | pass |
| collector_origin_exact | pass |
| page_view_present | pass |
| cta_click_present | pass |
| line_add_not_inferred | pass |

## Collector Contract

- Preflight: 204
- Exact allowed origin: http://127.0.0.1:60618
- Allowed page_view rows: 1
- Allowed cta_click rows: 1
- Denied-origin rows: 0
- line_add rows: 0
- Sensitive rows: 0

## Gate

Production deploy and public-link changes remain owner approval gates. This smoke does not click the LINE CTA and does not infer line_add from cta_click.
