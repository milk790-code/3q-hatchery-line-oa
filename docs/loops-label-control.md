# LOOPS GitHub Label Control

Use GitHub issue labels to steer the next LOOPS run without editing config.

## Labels

- `loop:retry`: run the matching config task again, bypassing its normal dedup window.
- `loop:promote`: run the matching config task again with a stronger priority boost.
- `loop:ignore`: suppress the matching config task for this run.

## Matching

LOOPS reads open issues with those labels and looks for task references in the issue body:

```md
- `cloudflare_worker_health` / `3q-social-publisher-health`: failed - status 500
```

Those references are already written by the GitHub issue reporter. If an issue has no parseable task reference, LOOPS records a `note` task instead of guessing.

## Consumption

By default, label control is read-only. LOOPS can turn labels into local run-plan tasks, but it does not comment on issues or remove labels.

Acknowledgement is a GitHub write. It requires both:

- `acknowledge_labels: true` in the task payload.
- `LOOPS_ALLOW_GITHUB_LABEL_ACK=1` in the local environment.

Without both gates, LOOPS records a warning and leaves the GitHub issue unchanged.

The control plane only uses the three `loop:*` labels above. It does not execute arbitrary commands from issue text.
