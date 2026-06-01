# Abak Role Journey Testing Pack

> **Role model updated (2026-06-01).** These end-to-end journeys remain valid; read each role label as its template in `abak-rbac-test-plan.md` (e.g. "Technical Department Manager" = an Engineer who is the department's `managerId`; "Admin/Main Manager" = Executive). Access is now decided by permission + scope, not the old `appRole` enum.

Purpose: use the real Abak accounts from `abak-user-role-matrix.md` to test the ERP as each role would experience the client lifecycle.

Do not test with the `System / Company account` as a human user.

## Core end-to-end scenario

Use one realistic project:

> New client requests architectural + surveying + safety services. Sales captures the lead, requests RFQ, departments price their sections, quote is approved/sent/won, project is created, licence dependency blocks one phase, finance validates payment, project closes.

## Test accounts by role

| Role                           | Suggested account(s)                                                                                                             | App role             | Main test purpose                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| Super Admin / CEO              | abdullah.mohsen@abak.com.sa                                                                                                      | SUPER_ADMIN          | all settings, approvals, overrides             |
| Main Manager / Executive Admin | mesfer@abak.com.sa, m.alayaf@abak.com.sa                                                                                         | ADMIN                | dashboards, triage, reports                    |
| Sales Manager                  | haitham@abak.com.sa                                                                                                              | ADMIN                | sales oversight, RFQ routing, escalations      |
| Sales Person                   | ghadah@abak.com.sa, client.relations1@abak.com.sa, client.relations2@abak.com.sa, mostafa@abak.com.sa, salwa@abak.com.sa         | SALES_REPRESENTATIVE | lead, CRM, follow-up, quote dispatch           |
| Technical Department Manager   | hassan@abak.com.sa, akram@abak.com.sa                                                                                            | ADMIN                | department assignment, Lead Pricer, conversion |
| Architectural Pricer           | abdulghani.almuwafiq@abak.com.sa, a.albittar@abak.com.sa, hashim.ali@abak.com.sa, khaled@abak.com.sa, osamah.alsamet@abak.com.sa | TECHNICAL_MANAGER    | RFQ section, quote items, project tasks        |
| Surveying Pricer               | alaa.ahmed@abak.com.sa, mohammed.deifallah@abak.com.sa                                                                           | TECHNICAL_MANAGER    | RFQ section, quote items, licence/task check   |
| Safety Pricer                  | omar@abak.com.sa, w.abid@abak.com.sa                                                                                             | TECHNICAL_MANAGER    | RFQ section, quote items, project tasks        |
| Civil/Supervision Pricer       | ameen@abak.com.sa                                                                                                                | TECHNICAL_MANAGER    | execution/project task scenario                |
| Finance Officer                | accounting@abak.com.sa                                                                                                           | FINANCE_MANAGER      | payment, invoice, finance validation           |
| HR / Viewer                    | hr@abak.com.sa, salshehri@abak.com.sa                                                                                            | VIEWER               | access-boundary test only                      |

## Journey 1 — Sales Person

**Accounts:** `ghadah@abak.com.sa`, `client.relations1@abak.com.sa`, `client.relations2@abak.com.sa`

### Goal

Own the client relationship from first contact until quote dispatch/outcome.

### Happy path

1. Login as Sales Person.
2. Create new lead.
3. Add client contact data.
4. Log first communication: call/WhatsApp/email/meeting.
5. Schedule follow-up.
6. Move lead through qualification/pipeline.
7. Request RFQ.
8. Select departments: Architectural + Surveying + Safety.
9. Attach required client docs.
10. Wait for quote readiness notification.
11. Send quote / mark quote as sent.
12. Log negotiation communication.
13. Mark quote Won/Lost/Postponed.
14. If Won, attach signed/award evidence if available.

### Expected system behaviour

- Sales remains client thread-of-record.
- Communication timeline stays complete.
- Follow-up due/overdue state appears.
- Sales cannot perform admin-only pricing policy changes.
- Sales cannot bypass department pricing/approval.

### Test failures to catch

- Sales can access admin settings.
- RFQ can be submitted without department scope.
- Follow-up has no reminder/escalation.
- Quote can be marked Won without required evidence/rules, if rules exist.

## Journey 2 — Sales Manager / Sales Admin

**Account:** `haitham@abak.com.sa`

### Goal

Monitor pipeline, support stuck leads, and coordinate sales handoffs.

### Happy path

1. Login as Sales Manager/Admin.
2. View sales dashboard/pipeline.
3. Inspect new/stuck/overdue leads.
4. Open Sales Person’s lead.
5. Review communications log and follow-up history.
6. Check RFQ request status.
7. Confirm Sales Person is still responsible client owner.
8. Review sent quote and client outcome.

### Expected system behaviour

- Manager sees team pipeline, not only own records.
- Manager can inspect and intervene where allowed.
- Manager cannot silently rewrite technical pricing without proper role/approval trail.

### Test failures to catch

- Manager cannot see team work.
- Manager can break audit trail.
- Stuck/overdue items are invisible.

## Journey 3 — Technical Department Manager

**Accounts:** `hassan@abak.com.sa`, `akram@abak.com.sa`

### Goal

Receive RFQ, assign pricers, select Lead Pricer, and convert won quote to project.

### Happy path

1. Login as Department Manager.
2. Open pending RFQ.
3. Review selected departments and attachments.
4. Assign Architectural pricer.
5. Assign Surveying pricer.
6. Assign Safety pricer.
7. Select one Lead Pricer.
8. Track each section’s completion.
9. Review final quote before/after approval.
10. After quote is Won, use Convert to Project.
11. Confirm project carries departments, quote line items, docs, and payment schedule.

### Expected system behaviour

- Multi-department RFQ has exactly one Lead Pricer.
- Co-pricers can own sections.
- Department manager sees assignment status.
- Convert-to-project is not available too early.

### Test failures to catch

- No Lead Pricer enforcement.
- Any user can convert quote to project.
- Converted project loses scope/items/docs.
- RFQ assignment still uses raw UUID fields.

## Journey 4 — Department Engineer / Pricer

**Accounts:** architectural/survey/safety technical users.

### Goal

Prepare pricing section, ask for missing docs/site visit, and contribute to quote/project delivery.

### Happy path

1. Login as Technical Manager/Pricer.
2. Open assigned RFQ.
3. Review client/RFQ scope and docs.
4. Add pricing items for own department.
5. Add methodology/Gantt data per quote item if available.
6. Request additional document if missing.
7. Request site visit if needed.
8. Submit section.
9. If Lead Pricer, assemble final quote and submit for approval.
10. After project creation, open assigned project/tasks/phases.
11. Update task or licence status when relevant.

### Expected system behaviour

- Pricer sees assigned RFQs only, unless manager/admin.
- Request loops go back to Sales Person and are logged.
- Lead Pricer sees aggregate view.
- Non-lead co-pricers cannot accidentally submit final quote unless allowed.

### Test failures to catch

- Pricer sees all departments’ private work incorrectly.
- No way to request missing docs/site visit.
- Quote item accepts invalid payment/methodology data.
- Project tasks/licences are not visible after conversion.

## Journey 5 — Lead Pricer

**Suggested account:** choose one assigned department engineer in test, e.g. `abdulghani.almuwafiq@abak.com.sa`.

### Goal

Coordinate multi-department quote into one final client offer.

### Happy path

1. Login as Lead Pricer.
2. Open multi-department RFQ.
3. Review all department sections.
4. Check missing sections.
5. Request revision from a co-pricer if needed.
6. Assemble final quote.
7. Confirm payment schedule totals 100%.
8. Submit for approval.
9. Track approval status.

### Expected system behaviour

- Lead Pricer can see all sections.
- Payment schedule validation blocks invalid totals.
- Approval chain is created from Pricing Policy.
- Changes are auditable.

### Test failures to catch

- Multiple Lead Pricers allowed.
- Payment schedule not validated.
- Approval chain missing for discount/value.
- Co-pricer edits after final submit without revision trail.

## Journey 6 — Finance Officer

**Account:** `accounting@abak.com.sa`

### Goal

Validate commercial/payment parts of quote and project lifecycle.

### Happy path

1. Login as Finance Officer.
2. Open finance dashboard/queue.
3. Review won quote/payment schedule.
4. Validate invoice/payment/commercial confirmation.
5. Reject invalid payment with reason.
6. Confirm project closure finance gates.
7. Check reports/AR ageing if available.

### Expected system behaviour

- Finance can see payment/commercial data.
- Finance cannot mutate sales/technical scope without permission.
- Rejection requires reason.
- Closure blocks if finance gates are incomplete.

### Test failures to catch

- Finance cannot access required payment records.
- Finance can bypass project/quote ownership controls.
- Rejections do not notify responsible actor.

## Journey 7 — Super Admin / CEO

**Account:** `abdullah.mohsen@abak.com.sa`

### Goal

Configure policy, approve exceptional decisions, and verify access controls.

### Happy path

1. Login as Super Admin.
2. Review users and roles.
3. Open Pricing Policy settings.
4. Configure discount thresholds.
5. Approve/reject high-discount quote.
6. Open licence-blocked project.
7. Approve/reject CEO override with justification.
8. Review reports/dashboard.
9. Confirm audit trail exists.

### Expected system behaviour

- Super Admin can access all admin areas.
- Policy changes affect new approval chains.
- Override requires justification.
- Audit trail records decision.

### Test failures to catch

- Normal users can access Super Admin functions.
- Pricing Policy does not affect quote approvals.
- Override lacks audit record.

## Journey 8 — Viewer / HR / Executive Viewer

**Accounts:** `hr@abak.com.sa`, `salshehri@abak.com.sa`

### Goal

Verify access boundaries.

### Happy path

1. Login as Viewer.
2. Try to access dashboard/report pages.
3. Try to open sales/quote/project pages.
4. Try to create/edit/delete records.
5. Try to open admin/settings.

### Expected system behaviour

- Viewer can see only allowed read-only surfaces.
- Viewer cannot create/update/delete operational records.
- Viewer cannot approve, assign, or override.

### Test failures to catch

- Viewer can mutate records.
- Viewer sees sensitive finance/admin data without need.
- Viewer gets broken/blank pages instead of clear permission state.

## Cross-role full test script

Run this once with multiple logins:

1. **Sales Person:** create lead + log communication + request RFQ.
2. **Sales Manager:** review pipeline and RFQ request.
3. **Department Manager:** assign three pricers and choose Lead Pricer.
4. **Pricer 1:** submit architectural section.
5. **Pricer 2:** submit surveying section.
6. **Pricer 3:** submit safety section or request missing docs.
7. **Sales Person:** answer missing-doc request.
8. **Lead Pricer:** assemble quote + submit approval.
9. **CEO/Admin:** approve exceptional discount if triggered.
10. **Sales Person:** send quote and mark Won.
11. **Department Manager:** convert to project.
12. **Department Engineer:** update project phase/task.
13. **Department Engineer/Manager:** add blocking licence.
14. **CEO:** test override path if needed.
15. **Finance:** validate payment/commercial gate.
16. **Project owner/Manager:** close project.
17. **Viewer:** confirm cannot mutate any workflow.

## Testing evidence to capture

For each role, record:

- account used
- journey step
- expected result
- actual result
- screenshot/video link if useful
- bug or gap
- severity: blocker / high / medium / low
- decision needed from Amged/Abak

## Known role-model gaps

- Current app roles are coarse: `TECHNICAL_MANAGER` covers both department manager/engineer in many cases.
- `HR Manager` maps to `VIEWER` because HR is not MVP scope.
- `ADMIN` is overloaded for main managers and department managers.
- Future addendum may need finer roles or ABAC, but do not add now unless explicitly approved.
