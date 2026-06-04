# Security Policy

## Reporting a vulnerability

Email **security@mdtidy.com** with details and reproduction steps. Please do not
open a public issue for security reports. We aim to acknowledge within 3 business
days.

## Scope & design notes

- This repository contains **no mdtidy business logic**. The only thing crossing
  from the mdtidy service is the public OpenAPI contract (`contract/openapi.json`).
- The MCP server never stores API keys. In stdio mode the key is read from
  `MDTIDY_API_KEY`; in remote mode it is read from the request header and
  forwarded to `https://mdtidy.com/api/v1/*`. Keys are never logged.
- Credit charging, rate limiting, and audit all happen in the mdtidy API, which
  this layer calls over HTTPS.
