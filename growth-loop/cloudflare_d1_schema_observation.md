# Remote D1 Schema Observation

BLUF: the dedicated remote `3q-growth-loop-candidate` database already contains the exact Week 0 schema and seed. This observation performed read-only schema, seed, aggregate-count, and Time Travel checks; it did not rerun the migration.

- Dedicated database match: yes
- Expected application tables: 7 / 7 exact
- Expected event indexes: 3 / 3 present
- Week 0 assets: 2 / 2 exact
- Week 0 A/B row: 1 / 1 exact, allocation 90 / 10
- Aggregate `lp_events` count: 10
- Raw event rows read: no
- Customer data read: no
- Rows written by this observation: 0
- Current Time Travel bookmark recorded: yes
- Restore performed: no

## Historical migration evidence

Wrangler recorded the successful remote import at `2026-07-10T02:31:27.779Z`: 15 queries, 7 tables, 30 rows written, and a final bookmark. The current schema SQL and seed rows match `schema/d1-week0.sql`.

## Verification limitation

Cloudflare D1 rejected `PRAGMA integrity_check` with `SQLITE_AUTH`. This is recorded as an unsupported remote PRAGMA, not interpreted as database corruption. Table definitions, constraints, indexes, seeds, aggregate counts, and Time Travel availability were verified through supported read-only commands.
