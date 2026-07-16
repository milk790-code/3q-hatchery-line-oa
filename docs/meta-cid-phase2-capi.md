# Meta CID → LINE OA → Phase 2 CAPI handoff

Status: `BRANCH_READY / NOT_DEPLOYED / NO_CAPI_SEND`

## Phase 1 contract in this branch

1. The LINE OA Worker accepts both `【GO:to:src】` and `【GO:to:src:cid】`.
2. A valid `cid` is exactly eight hexadecimal characters.
3. The Worker reads `CLICK_KV.get("fbc:" + cid)` and records only:
   - `customer_profiles.meta_cid = cid`
   - `customer_profiles.source = "meta"`
4. Raw `fbclid` and `fbc` are not copied into D1, logs, session history, or documentation.
5. `/health` reports only whether the `CLICK_KV` binding exists; it never reveals click data.

## Phase 2 CAPI replay queue

Phase 2 is intentionally not implemented or sent in this branch. The reviewed follow-up should:

1. Select rows where `source='meta'` and `meta_cid IS NOT NULL`.
2. Re-read `fbc:{meta_cid}` from `CLICK_KV` immediately before the send.
3. Use the same eight-character `meta_cid` as the Meta `event_id` deduplication key.
4. Send only after `META_PIXEL_ID` and `META_CAPI_TOKEN` exist as encrypted Worker secrets.
5. Start with Meta Test Events and verify one `Lead` inside one minute before any production replay.
6. Record a replay ledger with `event_id`, send time, response status, and retry count; do not store token values or raw LINE message text.
7. Make retries idempotent and bounded; never resend an already accepted `event_id`.

## Release order and human gates

1. Review this branch and the existing disclosure-suite baseline.
2. Apply `db/migrations/010_customer_profiles_meta_attribution.sql` to the intended D1 database.
3. Confirm the deployment metadata preserves all existing bindings and adds `CLICK_KV` with namespace `b7c18769105143aeb3b1557b49b12455`.
4. Owner approves merge/deploy.
5. Verify `/health` reports `click_kv: true` and send one owner-approved LINE test marker.
6. Only then begin the separately reviewed Phase 2 Test Events run.

## Known bridge gap before switching D links

The current `/r` PR deliberately does not forward raw `fbclid` to `/collect`. Therefore a click that starts at `popmonster.vip/r?...` may have a valid `cid` but no matching `fbc:{cid}` record. Keep the three D links on the Worker GET endpoint until a separate privacy-reviewed bridge contract can create the required `fbc:{cid}` without leaking click identifiers to LINE or permanent analytics.
