# Sample design: regional event list (generic)

A deliberately small, generic design used to exercise the review pipeline. It contains a couple of
planted weaknesses so the pre-scan and reviewers have something to catch.

## Data model

- `sample_event` (single-line text `sample_name`, choice `sample_status`, date `sample_startdate`).
- `sample_session` (N:1 to `sample_event`).
- Region ownership via owning team.

## Coordinator list screen

The screen shows all events in the coordinator's region. The gallery binds to a filter on
`sample_status` and region. The gallery shows the full set of matching events.

Approval threshold: TBD.

## Manager view

Managers get a read-only view across all regions. Access is hidden in the UI for non-managers.

## Notes

The status filter uses a text comparison on the status label so it reads naturally.
