# Insurance Policy

**Effective Date:** 2 April 2026

This Insurance Policy describes the coverage model, trigger rules, payout logic, exclusions, limitations, and operational rules for ZyroSafe. It is a working draft intended for review and editing.

## 1. Policy Purpose
ZyroSafe is a parametric insurance product for food delivery partners. The policy is designed to provide fast financial support when defined external conditions affect the ability to work and earn.

This policy is not a traditional indemnity policy. It pays based on predefined triggers and rule-based evaluation rather than manual loss assessment.

## 2. Eligibility
A user may be eligible if all of the following are true:
- The user has an active account
- The user has provided accurate profile information
- The user has agreed to the required permissions and terms
- The user is within the supported service area
- The user has selected an eligible plan
- The user has not violated fraud or abuse rules

## 3. Covered Events
Coverage may apply when the configured trigger rules are met for events such as:
- Heavy rainfall
- Extreme heat
- Cyclones or storms
- Curfews
- Strikes
- Zone closures or other defined public disruption events

Coverage is only activated when the event matches the configured thresholds and the system validates the condition using available data.

## 4. Trigger Thresholds
The following thresholds may be used by the current product rules:
- Rainfall between 45 mm/day and 60 mm/day may indicate moderate disruption
- Rainfall above 60 mm/day may indicate severe disruption
- Temperature above 45°C may indicate extreme heat disruption
- Official storm or cyclone alerts may qualify as severe disruption

These thresholds can be revised as the product evolves.

## 5. Coverage Basis
Coverage is parametric. This means:
- Payment is based on a predefined trigger
- The system does not require proof of physical damage
- The system evaluates objective data feeds and rule logic
- The amount paid is based on the policy formula, not subjective assessment

## 6. Payout Formula
If a trigger is accepted, payout may be calculated using:

Payout = max(Minimum Payout, Hourly Income x Lost Hours x Plan Factor)

Where:
- Hourly Income = Weekly Income / Working Hours
- Lost Hours = Estimated hours impacted by the disruption
- Plan Factor depends on the selected plan

## 7. Plan Structure
The current plan structure may include:

| Plan | Premium | Plan Factor |
|------|---------|-------------|
| Basic | 5% | 0.8 |
| Standard | 7% | 1.0 |
| Premium | 10% | 1.2 |

Premiums are intended to be calculated on a weekly basis unless otherwise stated.

## 8. Minimum and Maximum Limits
The policy may apply the following limits:
- Minimum payout to avoid negligible compensation
- Weekly payout cap to protect product sustainability
- Additional internal caps or review limits where necessary

The exact caps should be finalized in product configuration and legal review.

## 9. Exclusions
Coverage may not apply when:
- The user provides false or incomplete information
- GPS or identity data cannot be reasonably validated
- The system detects spoofing, VPN abuse, or fabricated activity
- The event does not meet the configured threshold
- The user is outside the service area
- The service cannot verify the trigger with available data
- The claim is otherwise blocked under fraud or abuse rules

## 10. Fraud and Abuse Rules
The policy may deny, delay, or review claims if the system detects suspicious behavior such as:
- GPS and IP mismatch
- Unrealistic movement or impossible travel
- Repeated claim attempts
- Suspicious device, browser, or session patterns
- Clustered or coordinated claim behavior
- Anonymous or highly obfuscated network behavior

## 11. Claim Decision Outcomes
Claims may result in one of the following outcomes:
- Approved
- Flagged for review
- Rejected

Approved claims may result in an automatic payout according to policy rules.
Flagged claims may require manual or secondary review.
Rejected claims do not receive a payout.

## 12. Evidence and Data Used
The policy decision may rely on:
- Live weather data
- GPS coordinates
- Reverse geocoded locality or area
- IP-based location approximation
- User profile information
- Transaction and session history
- Fraud scoring output

## 13. Service Area
The policy may only apply within supported cities, regions, or delivery zones. Coverage outside the defined service area may be excluded or treated as ineligible.

## 14. Waiting Periods and Activation
If needed, the product may include activation delays, onboarding checks, or waiting periods before coverage becomes available. These should be specified in the final commercial policy.

## 15. Premium Collection
Premiums may be collected weekly or in another configured billing cycle. Non-payment, failed billing, or account suspension may affect eligibility.

## 16. Claim Review and Disputes
If a user believes a claim was handled incorrectly, the user may request review through the designated support process. Review decisions may consider:
- System logs
- Weather records
- Location records
- Account consistency
- Prior claim behavior

## 17. Third-Party Dependencies
The policy may depend on third-party services for:
- Authentication
- Weather feeds
- Location lookup
- Hosting and storage
- Notification or analytics services

Outages or inaccuracies from third-party services may affect coverage determination or timing.

## 18. Data Retention for Policy Administration
Claim records, fraud scores, and supporting logs may be retained for administrative, audit, security, and dispute purposes. Retention periods should be defined in the separate retention policy.

## 19. Changes to Coverage
The company may update thresholds, plan pricing, limits, exclusions, and operational rules from time to time. Users should be notified of material changes where required.

## 20. No Guarantee of Coverage
Coverage is only available when the configured rules are satisfied and the service is able to validate the event using available data. This draft does not guarantee payment in every adverse condition.

## 21. Governing Law
This section should be finalized for the jurisdiction where the policy will be offered.

## 22. Contact
For coverage questions, claim questions, or policy edits, contact the project owner or support channel associated with the application.

## 23. Drafting Note
This file is a draft insurance policy readme for review and editing. It is not legal advice and should be reviewed by qualified counsel before publication.
