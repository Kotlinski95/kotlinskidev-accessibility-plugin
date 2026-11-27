# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| Latest minor release | Yes: security and bug fixes |
| Previous minor release | Security fixes only, for 90 days after a new minor release |
| Anything older | No: update to a supported version |

Pre-releases (`beta`, `rc`) are not supported once the stable release they lead to is out.

## Reporting a vulnerability

Report privately through GitHub Security Advisories: open the repository, choose **Security**, then **Report a vulnerability** (https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/security/advisories/new).

Do not open a public issue, pull request or discussion for a vulnerability.

Include the plugin version, WordPress and PHP versions, the steps to reproduce, and the impact you expect. Do not include credentials, tokens, `wp-config.php` content, production data or other secrets, and do not test against sites you do not own.

## What to expect

| Step | Target |
| --- | --- |
| Acknowledgement | Within 7 days |
| Assessment and severity | Shared with the reporter after acknowledgement |
| Fix released | Within 30 days of acknowledgement for confirmed issues |
| Public advisory | After the fix is released, with credit if you want it |

There is no bug bounty.

## Automated checks

- CodeQL scans JavaScript, TypeScript and GitHub Actions workflows on every pull request and weekly.
- CodeQL does not support PHP. PHP is covered by PHPStan (level 8), the WordPress Coding Standards security sniffs, WordPress Plugin Check and `composer audit`.
- Dependabot opens weekly updates for npm, Composer and GitHub Actions; CI runs `npm audit --omit=dev --audit-level=high` and `composer audit`.
- Release assets carry a `.sha256` checksum, an Ed25519 detached signature (`.sig`) and a build provenance attestation.
- The site verifies the signature with `sodium_crypto_sign_verify_detached()` against the public key built into `src/php/Update/PackageVerifier.php`, after the checksum. The package URL must match the pinned GitHub release path exactly (no query, fragment, `..`, userinfo or port). The check fails closed for releases from 1.1.0; older releases without a `.sig` install after the checksum check, and a present but wrong signature always blocks.
- The private key lives only in the `RELEASE_SIGNING_KEY` repository secret (PEM). `bin/sign-release.mjs` refuses to run without it, with a non-Ed25519 key, or with a key whose public half differs from the pinned one, so a release job without the secret fails. Rotating the key means shipping a new pinned public key in a release signed with the old one.
