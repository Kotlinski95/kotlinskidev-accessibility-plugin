# Distributing the plugin to client sites

The plugin lives in its own repository and is released independently of the theme. Client sites install it once from a zip and then receive updates from GitHub releases.

## Flow

1. Add changelog entries under `[Unreleased]` and run `npm run release`. It bumps the plugin header, `KOTLINSKIDEV_A11Y_VERSION`, `package.json` and `package-lock.json` together.
2. Commit, tag `vX.Y.Z` and push with `git push --follow-tags`.
3. The `Release` workflow builds the assets, runs `composer install --no-dev -o`, generates translations, packages `kotlinskidev-accessibility.zip`, writes `kotlinskidev-accessibility.zip.sha256` and signs the zip into `kotlinskidev-accessibility.zip.sig`. It publishes all three as one GitHub release.
4. Client sites see a normal plugin update. `PackageVerifier` validates the package URL, checks the SHA-256 and verifies the Ed25519 signature. A missing or invalid signature aborts the update.

## Packaging

`npm run package` builds the same zip locally into `dist/`. File selection comes from `.distignore`. `.git`, `node_modules`, tests, sources and workflow files never ship. `vendor/` and `build/` ship.

## Signing keys

- The private key is the repository secret `RELEASE_SIGNING_KEY` (Ed25519, PKCS8 PEM). Without it the release job fails on purpose.
- The public key is pinned in `PackageVerifier`.
- `SIGNATURE_REQUIRED_FROM` sets the first version that must carry a signature. Older releases stay installable for rollback.
- To rotate, release a version signed with the old key that carries the new public key, then switch the secret.

## Client sites

- First install: upload `kotlinskidev-accessibility.zip` under Plugins > Add New > Upload Plugin. To replace an older copy, choose Replace current.
- Rollback and channels are covered in `README.md` under Installation and updates.
- The theme depends on this plugin only through the documented contract in `docs/API.md`.
