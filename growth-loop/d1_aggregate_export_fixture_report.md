# D1 Aggregate Export Fixture Report

BLUF: d1_aggregate_export_fixtures_ok. A fixture Wrangler proves grouped-count parsing without a real remote call.

| scenario | status | exit | remote_read | customer_data_read |
|---|---|---:|---|---|
| missing_allow_remote_blocks_before_query | ok | 2 | no | no |
| fixture_wrangler_proves_aggregate_only_export | ok | 0 | no | no |

- Real remote CLI performed: no
- Raw event rows read: no
- Customer data read: no
- Project real-events write performed: no
- External effect: no
