# Example scenario (generic)

A small, deliberately generic scenario to exercise the pipeline. No real client or data.

## Request (as a stakeholder might phrase it)

> "We run events. Coordinators need to register events, attach sessions and speakers to each event,
> and see only the events for their own region. Managers need a read-only view across all regions."

## What each stage produces

1. **BA analyst** turns this into user stories with acceptance criteria, e.g.:
   - *As a coordinator, I can create an event and attach one or more sessions and speakers, so that
     the event is complete before I submit it.*
     - AC: an event cannot be submitted without at least one session.
     - AC: a coordinator sees only events in their own region.

2. **Solution architect** proposes a Dataverse model (generic `sample_` prefix):
   - `sample_event` (1) --- (N) `sample_session`
   - `sample_event` (N) --- (N) `sample_speaker`
   - Region-based security via business units or an owning-team model.
   - Notes the delegation implication: the coordinator's event list must filter server-side.

3. **Design reviewer** (adversarial) checks the design before build, e.g.:
   - "The region filter must be delegable on the chosen data source, or large regions will silently
     cap the coordinator's list." (platform-correctness lens)
   - "Read-only manager access should be a security role, not a client-side hide." (consistency lens)

4. **Developer** builds the canvas app, any plugins, and flows - under the deterministic rules/hooks.

5. **Test engineer** writes an end-to-end check: a coordinator sees only their region's full list
   (not a delegation-capped subset), and cannot submit an event with zero sessions.

6. **DevOps engineer** segments the solution and defines the environment/deploy path.

This scenario is intentionally close to common Power Platform shapes (parent/child, N:N, region-scoped
security, delegation) so the rules and reviews have something real to bite on - while staying entirely
generic.
