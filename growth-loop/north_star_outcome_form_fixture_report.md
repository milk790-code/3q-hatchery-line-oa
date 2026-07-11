# 3Q Growth Loop North Star Outcome Form Fixture Report

BLUF: pass. Static local guard checked the browser-only P1 outcome form contract.

Generated: 2026-07-10T21:44:57.537Z
Mode: north_star_outcome_form_fixture_static_guard
Rows: 24
Events: link_click, lead_submit, deal, quality_flag
Download filename: source_capture_ledger.filled.csv
Browser static checks executed: yes
Form export replay executed: no
Source compile commands executed: no
data/lp_events.jsonl write performed: no
External effect: no
Production deploy performed: no
Public link change performed: no
GitHub push / PR performed: no
Formal post performed: no
LINE push performed: no
Customer-data mutation performed: no
Payment action performed: no
Delete action performed: no

## Checks

| check | result | message |
|---|---|---|
| status_ok | pass | form status must be ok |
| mode | pass | form mode must be local browser-only |
| template_source | pass | form must read source_capture_ledger.fill-template.csv |
| row_count | pass | form must cover exactly 24 P1 outcome rows |
| event_type_count | pass | form must cover link_click, lead_submit, deal, and quality_flag |
| download_filename | pass | form must export source_capture_ledger.filled.csv |
| browser_only | pass | form must be browser-only |
| browser_persistence_false | pass | form must not persist browser data |
| network_false | pass | form status must declare no network calls |
| live_input_false | pass | form must not create live input files |
| event_write_false | pass | form must not write data/lp_events.jsonl |
| external_false | pass | form must not claim external effects |
| html_title | pass | HTML must include the form title |
| html_no_external_effect | pass | HTML must mark no external effect |
| html_no_network_marker | pass | HTML must mark no network |
| html_mentions_download | pass | HTML must mention the download filename |
| html_has_form | pass | HTML must include a local owner form with no action |
| html_no_form_action | pass | HTML form must not define an action URL |
| html_download_control | pass | HTML must include CSV download control |
| html_no_fetch | pass | HTML must not call fetch |
| html_no_xhr | pass | HTML must not send beacons or XHR |
| html_no_persistence | pass | HTML must not use browser persistence APIs |
| html_no_external_links | pass | HTML must not link to external URLs |
| quality_score_guard | pass | HTML must restrict quality_score to quality_flag rows |
| required_headers | pass | template must include all owner-required fields |
| real_events_unchanged | pass | fixture guard must not change data/lp_events.jsonl |
