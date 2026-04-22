# OWASP Top 10 — Security Review Checklist

This reference is used by the `security-reviewer` skill.

## A01 — Broken Access Control

- [ ] Every route/endpoint has explicit authorisation checks
- [ ] Users can only access their own resources (check ownership, not just auth)
- [ ] Admin/privileged routes are separately gated
- [ ] CORS is restricted to known origins; not `*` in production
- [ ] Directory listing disabled; no exposed `.git`, `.env`, backup files

## A02 — Cryptographic Failures

- [ ] Sensitive data encrypted at rest (passwords hashed with bcrypt/argon2/scrypt)
- [ ] No MD5 or SHA-1 for password hashing
- [ ] HTTPS enforced; no mixed content
- [ ] Secrets not stored in code, git history, or client-side bundles
- [ ] JWT secrets are sufficiently random and rotated

## A03 — Injection

- [ ] SQL queries use parameterised statements or an ORM — no string concatenation
- [ ] NoSQL inputs are validated (MongoDB `$where`, `$regex` input sanitised)
- [ ] Shell commands do not include unsanitised user input
- [ ] Template engines have auto-escaping enabled
- [ ] HTML output is escaped to prevent XSS

## A04 — Insecure Design

- [ ] Rate limiting applied to auth, password reset, and payment endpoints
- [ ] Multi-factor authentication available for sensitive accounts
- [ ] Password reset uses time-limited, single-use tokens
- [ ] Business logic cannot be abused through API manipulation (e.g. negative quantities)

## A05 — Security Misconfiguration

- [ ] Default credentials changed; no `admin/admin`
- [ ] Debug mode / stack traces disabled in production
- [ ] Unnecessary HTTP methods (PUT, DELETE) disabled where not needed
- [ ] Security headers present: `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`
- [ ] Dependency versions pinned; no `*` or `latest` in production manifests

## A06 — Vulnerable and Outdated Components

- [ ] Dependencies audited (`npm audit`, `pip audit`, `trivy`)
- [ ] No components with known Critical/High CVEs in production
- [ ] Lock files committed and kept up to date
- [ ] Base Docker images use specific tags, not `:latest`

## A07 — Identification and Authentication Failures

- [ ] Passwords have minimum length ≥ 12 chars; complexity optional per NIST SP800-63b
- [ ] Account lockout or progressive delay after repeated failures
- [ ] Session tokens are sufficiently random (≥128 bits entropy)
- [ ] Sessions invalidated on logout
- [ ] Password reset tokens expire (≤15 minutes) and are single-use

## A08 — Software and Data Integrity Failures

- [ ] CI/CD pipelines use pinned action versions (not `@main`)
- [ ] Signed commits or artifact signing for deployment pipelines
- [ ] Untrusted deserialization prevented; no `pickle`, `eval`, or `unserialize` on user data

## A09 — Security Logging and Monitoring Failures

- [ ] Auth failures logged (without sensitive data)
- [ ] Privileged actions logged with user ID and timestamp
- [ ] Logs are not accessible to end users
- [ ] Alerts exist for repeated failures or anomalous patterns

## A10 — Server-Side Request Forgery (SSRF)

- [ ] URLs fetched server-side are validated against an allowlist
- [ ] Responses from external fetches are not proxied verbatim to users
- [ ] Internal service URLs (169.254.x.x, 10.x.x.x) blocked from user-provided URLs
- [ ] Cloud metadata endpoints (169.254.169.254) explicitly blocked

---

## Quick-Flag Patterns

```
# Secrets in code
process.env.SECRET || "hardcoded-fallback"   ← flag: hardcoded fallback
const token = "sk-..."                        ← flag: literal secret

# SQL Injection risk
`SELECT * FROM users WHERE id = ${userId}`    ← flag: string interpolation

# XSS risk
element.innerHTML = userInput                 ← flag: unescaped HTML

# SSRF risk
fetch(req.body.url)                           ← flag: user-controlled URL
```
