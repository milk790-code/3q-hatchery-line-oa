function requireEventId(event) {
  if (!event || typeof event.event_id !== "string" || event.event_id.length === 0) {
    throw new Error("event_id is required for idempotent event-store operations");
  }
  return event.event_id;
}

function assertUniqueBatch(events) {
  const seen = new Set();
  for (const event of events) {
    const eventId = requireEventId(event);
    if (seen.has(eventId)) throw new Error(`duplicate event_id inside input batch: ${eventId}`);
    seen.add(eventId);
  }
  return seen;
}

export function planIdempotentAppend(existing, incoming) {
  const incomingIds = assertUniqueBatch(incoming);
  const existingIds = new Set(existing.map(requireEventId));
  const append = [];
  const skippedEventIds = [];
  for (const event of incoming) {
    if (existingIds.has(event.event_id)) skippedEventIds.push(event.event_id);
    else append.push(event);
  }
  return {
    append,
    skipped_event_ids: skippedEventIds,
    incoming_count: incomingIds.size,
    existing_count: existing.length,
  };
}

export function replaceAggregateWindow(existing, replacement, { campaign, startUtc, endUtc }) {
  assertUniqueBatch(replacement);
  const start = Date.parse(startUtc);
  const end = Date.parse(endUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("invalid aggregate replacement window");
  }

  const preserved = [];
  let replacedCount = 0;
  for (const event of existing) {
    const occurredAt = Date.parse(event.occurred_at);
    const isTargetAggregate =
      event.campaign === campaign
      && event.metadata_json?.collection === "remote_d1_grouped_count"
      && Number.isFinite(occurredAt)
      && occurredAt >= start
      && occurredAt <= end;
    if (isTargetAggregate) replacedCount += 1;
    else preserved.push(event);
  }

  const preservedIds = new Set(preserved.map(requireEventId));
  for (const event of replacement) {
    if (preservedIds.has(event.event_id)) {
      throw new Error(`replacement event_id collides with preserved event: ${event.event_id}`);
    }
  }

  return {
    events: [...preserved, ...replacement],
    replaced_count: replacedCount,
    preserved_count: preserved.length,
    replacement_count: replacement.length,
  };
}
