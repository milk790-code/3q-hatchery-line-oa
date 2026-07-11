export function splitCountItems(raw) {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => line.split(/[,;]+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function expectedRowsIssues(handoff) {
  if (!Array.isArray(handoff?.all_rows) || handoff.all_rows.length === 0) {
    return [{
      row_number: null,
      field: "all_rows",
      code: "missing_expected_p0_rows",
      message: "The batch handoff must contain at least one expected P0 row.",
    }];
  }
  return [];
}
