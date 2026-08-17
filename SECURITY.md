# Security

Malleable Text is retired. No version receives security fixes, and no new release is planned. Existing consumers should remove the dependency or maintain their own reviewed fork before relying on it.

GitHub's private vulnerability reporting remains available for responsible disclosure, but a report does not imply a response, fix, or release. Do not put sensitive details in a public issue.

## Supported versions

| Version | Security fixes |
| --- | --- |
| `v0.1.0` and all branches | Not supported |

## Security boundary

Malleable Text does not authenticate users. The host application must authenticate and authorize every replace, reset, and alias migration. The host must derive the actor ID and `malleableTextAdmin` capability from trusted server state. A client-provided actor ID or capability is untrusted input.

The Convex Component isolates its tables from the host application. Isolation does not make its mutations safe to expose directly. Expose host queries and mutations that call the component only after they apply the host's policy. Authorize the requested identity and every effective alias identity as the same actor.

Public reads are an application choice. A host that stores confidential prose must authorize reads too. Do not persist secrets, credentials, personal data, untrusted HTML, or executable content with this package.

Source fingerprints detect source drift. They are deterministic, non-cryptographic values and are not suitable for access control, signatures, or integrity protection.

## Threat model

Assume that an untrusted caller can inspect the browser code, invoke every exported host function, forge request fields, replay request IDs, race another writer, and modify client-side author state. The host authorization callback, foreign-input parsers, bounded values, quoted ranges, expected revisions, and exact recent request replay protect the persistence boundary under those conditions.

Anonymous reads enforce descriptor, identity, alias-hop, and aggregate lookup limits. These limits reduce database-work amplification. They do not replace host read authorization for confidential prose.

The package does not protect an application after its host authorization code, identity provider, Convex deployment credentials, server runtime, or author account is compromised. It also does not prevent cross-site scripting elsewhere in the host. The host must render saved prose as text and apply its normal account, session, deployment, and browser security controls.
