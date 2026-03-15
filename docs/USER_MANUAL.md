# HikmahOne LeadOps User Manual

This guide reflects the current product behavior in the local workspace.

## Daily Workflow
- Confirm your active branch context before working. Dashboard, Due Queue, Leads, and notifications all follow the selected branch scope.
- Use the Due Queue to work follow-ups that are due now, overdue, or escalated.
- Update lead stage and next follow-up together so reminders, dashboard health, and queue state stay aligned.
- Watch the notification bell for due reminders, first-level escalations, and second-level admin escalations.
- Use the bell inbox to clear unread notifications after you act so the header count stays meaningful.

## Dashboard
- The dashboard is branch-aware. If a branch is selected globally, dashboard cards and charts follow that branch.
- `Follow-up Health` shows:
  - `Overdue`: open follow-ups scheduled before today that have not escalated yet
  - `Escalated`: open follow-ups that have reached first- or second-level escalation
  - `Due Today`: open follow-ups scheduled today that have not escalated yet
  - `Completed Today`: follow-ups completed today
- The fourth chart changes by scope:
  - multi-branch view: branch comparison
  - single-branch or single-scope view: source mix
- `Source Mix` is shown as a pie chart in scoped views so operators can see where the current pipeline is coming from at a glance.

## Due Queue
- The Due Queue replaces the old overdue checkbox with a status filter:
  - `All due`
  - `Due today`
  - `Overdue`
  - `Escalated`
- Escalated follow-ups stay in the queue and are visually stronger than normal overdue items.
- Second-level escalations show an `L2` badge and sort above first-level escalations.
- In `All due`, second-level escalations appear first, then first-level escalations, then the remaining due work.
- Marking a follow-up done removes it from open queue views and cancels pending reminder/escalation jobs.

## Follow-Ups, Reminders, and Escalations
- Creating a lead creates an initial pending `GENERAL` follow-up.
- Follow-up scheduling uses tenant reminder rules:
  - `defaultLeadFollowupMinutes`: default offset used by the lead create form
  - `firstReminderMinutes`: first reminder before the scheduled time
  - `escalationMinutes`: first escalation after the scheduled time if still open
- Current delayed follow-up flow:
  - reminder at `scheduledAt - firstReminderMinutes`
  - first escalation at `scheduledAt + escalationMinutes`
  - second escalation at `scheduledAt + (2 × escalationMinutes)`
- First escalation notifies the accountable user:
  - `followUp.assignedTo`
  - fallback `lead.ownerId`
- Second escalation notifies a tenant admin:
  - prefer an active tenant admin whose `defaultBranchId` matches the lead branch
  - otherwise use the earliest active tenant admin in the tenant
- Escalation is not auto-reassignment. The same follow-up stays in the queue until someone marks it done or reschedules it.

## Notifications
- The bell in the header is a live inbox, not a decorative icon.
- Notification types currently include:
  - follow-up reminder
  - first-level escalation
  - second-level escalation
- Notifications are delivered in two ways:
  - persisted in the notification inbox
  - realtime toast while the target user is connected
- You can:
  - open the inbox
  - mark one item read
  - mark all items read

## Lead Creation and Ownership
- `ownerId` is optional in the API, but the backend now resolves a fallback owner when missing.
- Manual lead creation fallback:
  - current authenticated user becomes owner
- Intake/webhook lead creation fallback:
  - prefer the earliest logged-in active user whose `defaultBranchId` matches the resolved branch
  - otherwise earliest logged-in active tenant user
  - if nobody has login history, fall back to the earliest active tenant user
- The initial follow-up inherits the resolved owner as `assignedTo` so reminders have a recipient when possible.
- The lead create form defaults `Next follow-up` from tenant settings using `defaultLeadFollowupMinutes`.

## Settings and Team Operations
- Tenant reminder rules, timezone, and business hours are managed from Settings.
- Reminder settings currently control:
  - default next follow-up offset for new leads
  - first reminder lead time
  - first and second escalation timing
- Team management controls:
  - users
  - roles
  - branch scope
  - default branch
  - tenant admin access
- Tenant admins and superadmins can manage reminder settings. Regular staff should treat these as controlled operational changes.

## Platform Admin
- Platform Admin is for superadmins only.
- Current capabilities include:
  - tenant list and summary
  - tenant drawer with users, branches, settings, roles, and audit data
  - branch management
  - role management
  - tenant user management and password reset

## Operational Notes
- Escalation is a visibility and accountability workflow, not auto-reassignment.
- Old follow-ups with only `escalatedAt` still count as escalated.
- Dashboard counts and the Due Queue are aligned by branch scope, but they answer different questions:
  - dashboard health summarizes queue state
  - Due Queue shows actionable follow-up rows
- Notifications are created only when reminder or escalation jobs actually fire; scheduling a follow-up does not create an inbox row immediately.
