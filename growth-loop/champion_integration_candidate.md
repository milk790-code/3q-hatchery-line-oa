# 3Q Site Champion Integration Candidate

BLUF: Local candidate is ready for owner review. It removes the false-success contact form, uses a LINE-only contact path, and prepares privacy-safe page_view / cta_click telemetry. Nothing was deployed or pushed.

Generated: 2026-07-10T21:44:35.313Z
Source commit: f86faa7356ac7962d9b429951b67c742370271c0
Observed ref commit: f86faa7356ac7962d9b429951b67c742370271c0
Ref advanced without target-file drift: no
Source blob: c9ffd646fd88750b6170fa1aa8ac2acd91c6f5a1
Source mode: git_ref_pinned
Source snapshot: integrations/3q-site/source/worker.origin-main.js
Exact source lock: yes
Worker dry run: pass

## Checks

| check | result |
|---|---|
| false_success_state_removed | pass |
| personal_input_controls_removed | pass |
| line_only_contact_mode_present | pass |
| configured_line_url_present | pass |
| telemetry_disclosure_accurate | pass |
| telemetry_injection_present | pass |
| attribution_persisted_across_pages | pass |
| client_tokens_sanitized | pass |
| embedded_pii_rejected | pass |
| session_uuid_only | pass |
| cryptographic_session_only | pass |
| collector_binding_exact | pass |
| collector_literal_script_safe | pass |
| collector_env_present | pass |
| credentials_omitted | pass |
| line_add_not_inferred | pass |
| local_status_endpoint_present | pass |
| build_marker_present | pass |
| html_cache_disabled | pass |

## Privacy Contract

- Customer fields collected: no
- Credentials sent: no
- LINE add inferred from click: no
- Events: page_view and cta_click only
- Downstream line_add / lead / deal: reviewed evidence required

## Human Gate

- Review patch: integrations/3q-site/generated/worker.candidate.patch
- Review candidate: integrations/3q-site/generated/worker.candidate.js
- Configure the deployed collector URL only after approval.
- Production deploy, public link changes, GitHub push/PR, and LINE sends remain blocked.
