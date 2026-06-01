# Abak Journey Test Checklist

Use this as the execution sheet while testing real accounts.

## Test run info

- Date:
- Tester:
- Environment: local / staging / live
- Temp password batch:
- Build/commit:

## Checklist

| #   | Role                 | Account                          | Step                                | Expected                              | Actual | Status | Severity | Notes |
| --- | -------------------- | -------------------------------- | ----------------------------------- | ------------------------------------- | ------ | ------ | -------- | ----- |
| 1   | Sales Person         | ghadah@abak.com.sa               | Create lead                         | Lead created with owner               |        |        |          |       |
| 2   | Sales Person         | ghadah@abak.com.sa               | Log communication                   | Timeline entry appears                |        |        |          |       |
| 3   | Sales Person         | ghadah@abak.com.sa               | Schedule follow-up                  | Follow-up due date saved              |        |        |          |       |
| 4   | Sales Person         | ghadah@abak.com.sa               | Request RFQ                         | RFQ created with selected departments |        |        |          |       |
| 5   | Sales Manager        | haitham@abak.com.sa              | Review pipeline                     | Team lead/RFQ visible                 |        |        |          |       |
| 6   | Department Manager   | hassan@abak.com.sa               | Assign pricers                      | Pricers assigned per department       |        |        |          |       |
| 7   | Department Manager   | hassan@abak.com.sa               | Select Lead Pricer                  | Exactly one Lead Pricer               |        |        |          |       |
| 8   | Architectural Pricer | abdulghani.almuwafiq@abak.com.sa | Submit pricing section              | Section submitted                     |        |        |          |       |
| 9   | Surveying Pricer     | alaa.ahmed@abak.com.sa           | Submit pricing section              | Section submitted                     |        |        |          |       |
| 10  | Safety Pricer        | omar@abak.com.sa                 | Request missing document/site visit | Request routed to Sales               |        |        |          |       |
| 11  | Sales Person         | ghadah@abak.com.sa               | Respond to request                  | Request resolved/logged               |        |        |          |       |
| 12  | Lead Pricer          | abdulghani.almuwafiq@abak.com.sa | Assemble quote                      | Combined quote ready                  |        |        |          |       |
| 13  | Lead Pricer          | abdulghani.almuwafiq@abak.com.sa | Validate payment schedule           | 100% required                         |        |        |          |       |
| 14  | Lead Pricer          | abdulghani.almuwafiq@abak.com.sa | Submit quote for approval           | Approval chain created                |        |        |          |       |
| 15  | CEO/Super Admin      | abdullah.mohsen@abak.com.sa      | Approve high discount               | Decision audited                      |        |        |          |       |
| 16  | Sales Person         | ghadah@abak.com.sa               | Mark quote sent                     | Quote state = Sent                    |        |        |          |       |
| 17  | Sales Person         | ghadah@abak.com.sa               | Mark quote won                      | Won evidence captured                 |        |        |          |       |
| 18  | Department Manager   | hassan@abak.com.sa               | Convert to project                  | Project created from quote            |        |        |          |       |
| 19  | Technical user       | a.albittar@abak.com.sa           | Update project task/phase           | Task/phase update saved               |        |        |          |       |
| 20  | Technical user       | a.albittar@abak.com.sa           | Add blocking licence                | Phase blocked/paused                  |        |        |          |       |
| 21  | CEO/Super Admin      | abdullah.mohsen@abak.com.sa      | Licence override                    | Requires justification + audit        |        |        |          |       |
| 22  | Finance              | accounting@abak.com.sa           | Validate payment/commercial gate    | Finance state updated                 |        |        |          |       |
| 23  | Finance              | accounting@abak.com.sa           | Reject invalid payment              | Reason required + notification        |        |        |          |       |
| 24  | Project owner        | hassan@abak.com.sa               | Close project                       | Closure requires gates/evidence       |        |        |          |       |
| 25  | Viewer               | hr@abak.com.sa                   | Try editing workflow record         | Access denied/read-only               |        |        |          |       |
| 26  | Viewer               | salshehri@abak.com.sa            | Try admin/settings                  | Access denied                         |        |        |          |       |

## Status values

- Pass
- Fail
- Partial
- Blocked
- Not available

## Severity values

- Blocker: prevents full test path
- High: breaks role responsibility or data integrity
- Medium: workaround exists
- Low: copy/UI issue
