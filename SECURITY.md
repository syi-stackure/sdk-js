# Security Policy

## Reporting a vulnerability

Do **not** file a public GitHub issue for security vulnerabilities.

Report privately via **[GitHub Security Advisories](https://github.com/syi-stackure/sdk-js/security/advisories/new)**. This routes the report directly to the maintainer and keeps the disclosure channel private until a fix is ready.

Please include:

- A description of the issue and its impact
- Steps to reproduce or proof-of-concept
- The SDK version or commit SHA affected
- Your disclosure timeline preferences

You will receive an acknowledgment within 72 hours. Fixes are released as patch versions with a corresponding GitHub Security Advisory once coordinated disclosure is complete.

## Supply chain

Every release is published to npm with **[npm provenance](https://docs.npmjs.com/generating-provenance-statements)** — a Sigstore-backed SLSA L3 attestation linking the published tarball to the exact GitHub Actions workflow run that built it.

Verify a published version:

```bash
# npm CLI shows provenance status on any package
npm view stackure --json | jq .dist.attestations
```

Or view provenance on the [package page](https://www.npmjs.com/package/stackure) → "Provenance" badge.

Build-provenance attestations are additionally recorded via the [GitHub attestations API](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds):

```bash
gh attestation verify stackure-<version>.tgz --owner syi-stackure
```

## Supported versions

Only the latest minor release receives security updates until v2.0.0. Starting at v2.0.0, the two most recent minor releases are supported.
