const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taipeiWeek(date) {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipeiDate);
  start.setDate(taipeiDate.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const startDate = dateOnly(start);
  const endDate = dateOnly(end);
  return {
    start: startDate,
    end: endDate,
    startUtc: new Date(`${startDate}T00:00:00.000+08:00`).toISOString(),
    endUtc: new Date(`${endDate}T23:59:59.999+08:00`).toISOString(),
  };
}

export function completedTaipeiWeek(now) {
  const current = taipeiWeek(now);
  const previousAnchor = new Date(new Date(`${current.start}T00:00:00.000+08:00`).getTime() - DAY_MS);
  return taipeiWeek(previousAnchor);
}

export function filterEventsForWeek(events, week) {
  const start = Date.parse(week.startUtc);
  const end = Date.parse(week.endUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Invalid scoring week bounds.");
  }
  return events.filter((event) => {
    const occurredAt = Date.parse(event.occurred_at);
    return Number.isFinite(occurredAt) && occurredAt >= start && occurredAt <= end;
  });
}

function ratio(numerator, denominator) {
  return denominator ? Number(numerator ?? 0) / Number(denominator) : 0;
}

export function canonicalRates(row) {
  const visits = Number(row.visits ?? 0);
  const linkClicks = Number(row.link_clicks ?? 0);
  const lineAdds = Number(row.line_adds ?? 0);
  const leads = Number(row.leads ?? 0);
  const denominator = visits || linkClicks;
  return {
    denominator,
    cta_rate: ratio(row.cta_clicks, visits || denominator),
    line_add_rate: ratio(lineAdds, visits),
    lead_rate: ratio(leads, lineAdds || denominator),
    close_rate: ratio(row.deals, leads || lineAdds || denominator),
  };
}
