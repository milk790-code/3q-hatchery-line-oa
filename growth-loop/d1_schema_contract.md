# D1 Schema Contract

BLUF: local_schema_idempotency_and_constraints_verified. The Week 0 migration was applied twice to a disposable local D1 database, then checked for idempotency, integrity, seed stability, and constraints. No remote D1 or customer data was touched.

- Schema SHA-256: abb969fbc496dea8e4914ea1c447a8e1ddf6a6beaf4ff77278ddd01978522d93
- Remote D1 create: no
- Remote D1 migration: no
- Remote D1 query: no
- Temporary state removed: yes

| check | result |
|---|---|
| first_migration_apply_ok | pass |
| second_migration_apply_ok | pass |
| migration_idempotent | pass |
| expected_tables_exact | pass |
| expected_indexes_present | pass |
| sqlite_integrity_ok | pass |
| foreign_key_check_clean | pass |
| seed_assets_exact | pass |
| seed_ab_test_exact | pass |
| event_type_constraint_enforced | pass |
| asset_role_constraint_enforced | pass |
| foreign_key_constraint_enforced | pass |
