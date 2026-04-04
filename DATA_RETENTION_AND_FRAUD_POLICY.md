# Data Retention and Fraud Policy

**Effective Date:** 2 April 2026

This policy describes how ZyroSafe retains data and how it identifies, reviews, and responds to potential fraud or abuse.

## 1. Purpose
This policy exists to:
- Protect the integrity of the payout system
- Preserve audit history
- Detect suspicious or abusive behavior
- Support dispute resolution and operational review
- Reduce the risk of false claims or coordinated attacks

## 2. Data Retention Overview
We may retain the following categories of data:
- Account profile information
- Session and login records
- Location and geocoding data
- Weather and trigger context
- Transaction history
- Fraud scores and review outcomes
- Error and diagnostic logs
- Administrative or support notes related to claims

## 3. Retention Principles
Data retention should follow these principles:
- Keep data only as long as needed for the stated purpose
- Retain audit records long enough to review claims and disputes
- Remove or anonymize data when it is no longer required
- Apply stricter retention rules to sensitive data where possible
- Keep production and fallback records consistent where applicable

## 4. Suggested Retention Periods
These are placeholder drafting values you can edit:
- Active account profile data: while the account remains active
- Transaction and payout history: 1 to 7 years depending on legal need
- Fraud review logs: 1 to 5 years depending on dispute risk
- Session data: until expiration or logout
- Temporary diagnostic logs: 7 to 90 days
- Location traces used for audit: only as long as needed for verification

## 5. When Data May Be Deleted or Anonymized
Data may be removed or anonymized when:
- It is no longer needed for service delivery
- A user requests deletion, subject to legal exceptions
- Retention limits are reached
- Records are superseded by newer verified records
- Security or compliance review is complete

## 6. Fraud Detection Signals
The service may evaluate fraud risk using signals such as:
- GPS and IP mismatch
- Unusual claim frequency
- Unrealistic movement or travel speed
- VPN, proxy, or anonymized network patterns
- Repeated trigger attempts
- Inconsistent profile, session, or device behavior
- Suspicious timing patterns across multiple users

## 7. Fraud Response Actions
If the system detects possible fraud, it may:
- Approve the record if no issue is found
- Flag the record for review
- Delay payment or processing
- Reject the claim or transaction
- Log the event for audit and investigation
- Restrict or suspend the account in serious cases

## 8. Human Review
Flagged cases may be reviewed manually where appropriate. Human review can consider:
- System logs
- Location context
- Weather context
- Claim history
- Account consistency
- Support communications

## 9. Data Used in Fraud Decisions
Fraud decisions may use a combination of:
- Live GPS coordinates
- Approximate IP location
- Weather data
- Profile data
- Timing and frequency signals
- Transaction state

These decisions are intended to protect the platform and its users.

## 10. Record Integrity
To support audits, the system should preserve transaction history and decision metadata in a tamper-resistant manner where possible. If fallback storage is used, it should be synchronized carefully so that records do not drift between sessions or browsers.

## 11. Access Controls
Access to retained data should be limited to authorized personnel or services that need the data for:
- Claim evaluation
- Fraud detection
- Support
- Compliance
- System maintenance

## 12. Security Measures
Suggested safeguards include:
- Authentication and authorization controls
- Encrypted transport where available
- Limited access to logs and records
- Periodic review of stored data
- Separation of live and diagnostic information

## 13. User Impact
Fraud checks may result in:
- A visible risk score
- A flagged status
- A rejection status
- A request for additional verification

Users should be informed that false location, trigger, or identity data can affect eligibility.

## 14. Third-Party Dependency Risk
Retention and fraud workflows may rely on third-party services for auth, databases, location lookup, and weather data. Service outages may affect the completeness or timing of records.

## 15. Policy Changes
This policy may be updated as the product evolves, especially if:
- Retention periods change
- New fraud signals are added
- New storage providers are introduced
- Legal obligations change

## 16. Contact
For questions about retention or fraud handling, contact the project owner or support channel associated with the application.

## 17. Drafting Note
This document is a working draft intended for review and editing. It is not legal advice and should be reviewed by qualified counsel before publication.
