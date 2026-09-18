# KayaMo support and issue reporting

Public support address, supplied by the owner: **help.kayamo@gmail.com**.
Support is handled directly by KayaMo's operator. This is a content/runbook pack;
no automated ticket submission, emergency monitoring or response-time SLA exists.

## Public support copy

### Need a hand?

Email [KayaMo support](mailto:help.kayamo@gmail.com) for help signing in, using the
app, reporting a problem, or asking about your data or accessibility.

For sign-in help, tell us whether the email did not arrive, the link expired, or
the link opened an error page. Never forward your sign-in link or password.
Demo entries stay in the browser where you created them and do not automatically
transfer when you sign in. Avoid clearing browser data while troubleshooting;
doing so can remove demo entries or unsynced work.

KayaMo is not an emergency or medical service. Support cannot provide diagnoses,
medical treatment or individualized clinical advice. For urgent health concerns,
contact an appropriate local medical service.

### Report a problem

Email **help.kayamo@gmail.com** with the subject **KayaMo issue: [short summary]**.

- Page or feature affected (omit private URL query parameters).
- What you tried, what you expected, and what happened instead.
- Steps to reproduce, if you know them.
- Approximate time and timezone.
- Browser/device and whether you were signed in or using the demo.
- Optional cropped screenshot with personal details removed.

Do not include passwords, sign-in links, API keys, payment details, full logs,
medical records or a diary export. If more information is needed, support will
ask for the minimum relevant detail. An issue report is not permission to read
your account's health records.

For a nutrition-data issue, identify the public food/source and describe the
discrepancy. A photo of a public product label is optional; remove identifying
details. Do not submit your personal food diary to demonstrate a catalog error.

### Accessibility feedback

Use the subject **KayaMo accessibility**. Tell us the page, the difficulty and,
optionally, the browser or assistive technology. You do not need to disclose a
disability or diagnosis. Tell us if you would prefer a particular way of replying.

### Privacy and account requests

Use the subject **KayaMo privacy request** and describe the request. For account
requests, contact us from the account's email where possible. Do not send identity
documents unless a verified, necessary process has been agreed. Support may need
to verify control of the account before acting. Signing out is not account deletion.

### Security reports

Use the subject **KayaMo security report**. Report privately, avoid accessing other
people's records, and share only the minimum non-sensitive reproduction detail.
Do not post credentials or private records in a public issue tracker. This contact
does not constitute a bug-bounty offer or authorization to test other users' accounts.

## Operator runbook (internal, not public footer copy)

1. Monitor the inbox regularly and enable strong account security/2-step verification.
   Use labels: Sign-in, Bug, Nutrition, Accessibility, Privacy, Security, Resolved.
2. Acknowledge the report without echoing sensitive content. Use an internal issue ID
   and a redacted summary when a code fix is needed. Do not commit user reports to Git.
3. Prioritize suspected data exposure, unauthorized writes and data loss. Pause risky
   operations if necessary; preserve minimal evidence and obtain incident advice.
4. Reproduce with synthetic data or a disposable account. Never reset a user's browser
   storage, migrate their entries, or inspect health records as a routine first step.
5. Verify account control for account-specific actions. Avoid security questions based
   on personal health history; never ask for a magic link, password or API key.
6. Treat deletion as a controlled workflow: inventory account data, sync queues,
   provider/storage copies and backups; verify scope, authorization and outcome.
   Do not claim instant deletion or completion before verifying it. No new automated
   deletion endpoint has been implemented by creating this document.
7. Reply with the outcome and any real limitation. Do not give untested recovery
   guarantees, medical advice or promises that nutrition databases are exhaustive.
8. Proposed policy: remove resolved support correspondence after 90 days unless an
   unresolved dispute, security incident or applicable obligation requires retention.
   This is an operator procedure to approve/configure, not existing automation.

## Reply templates

**Acknowledgment:** Thanks for reporting this. I handle KayaMo support and will
review the issue. Please don't send sign-in links, passwords or health records.
If I need additional troubleshooting information, I'll ask for specific details.

**Needs reproduction:** Could you share the affected page, your browser, and the
steps that led to the problem? Please use a redacted screenshot if helpful. Avoid
clearing browser data while we investigate because unsynced/demo entries may be lost.

**Resolved:** A fix for [issue] is available in [verified version/deployment]. Please
try [safe step]. If it still occurs, reply with what happened; no diary export needed.

**Privacy request:** I received your request. Before making account changes, I need
to verify control of the account and confirm the requested scope. I will explain any
verified retention limitations and confirm the outcome once the process is complete.
