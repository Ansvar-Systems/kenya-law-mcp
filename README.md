# Kenya Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/kenya-law-mcp)](https://www.npmjs.com/package/@ansvar/kenya-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/kenya-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/kenya-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/kenya-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/kenya-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Kenyan legislation, including data protection, cybercrimes, ICT, companies, and consumer protection law with full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~80-150 MB (full corpus of Kenyan federal legislation)

## Key Legislation Covered

| Act | Year | Significance |
|-----|------|-------------|
| **Data Protection Act** | 2019 | Comprehensive data protection law modeled on EU GDPR; established the Office of the Data Protection Commissioner (ODPC) |
| **Computer Misuse and Cybercrimes Act** | 2018 | Comprehensive cybercrime legislation (note: Sections 22, 23, 24, 27, and 53 were partially suspended by the High Court pending constitutional review) |
| **Kenya Information and Communications Act** | 1998 (amended) | Regulates telecommunications and ICT sector; establishes the Communications Authority of Kenya |
| **Companies Act** | 2015 | Modern company law framework replacing the Companies Act (Cap 486) |
| **Consumer Protection Act** | 2012 | Consumer rights and fair trade practices |
| **Access to Information Act** | 2016 | Right to access government-held information |
| **National Payment Systems Act** | 2011 | Regulation of payment systems including mobile money (M-Pesa) |
| **Constitution of Kenya** | 2010 | Supreme law; Article 31 guarantees the right to privacy |

## Regulatory Context

- **Data Protection Supervisory Authority:** Office of the Data Protection Commissioner (ODPC), established under the Data Protection Act 2019
- **Kenya's Data Protection Act 2019** is one of East Africa's most comprehensive data protection laws, significantly influenced by the EU GDPR
- **ODPC** has issued guidance notes on data protection impact assessments, cross-border data transfers, and data breach notification
- Kenya is a member of the African Union and the East African Community (EAC)
- Kenya uses a common law legal system inherited from British colonial administration

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Kenya Law](http://kenyalaw.org) | National Council for Law Reporting | HTML/PDF Scrape | Weekly | Government Open Data | All Acts of Parliament, subsidiary legislation, Kenya Gazette notices, selected case law |
| [Kenya Gazette](http://kenyalaw.org/kenya_gazette/) | Government Printer, Republic of Kenya | PDF | Weekly | Government Publication | Gazette notices, Legal Notices, statutory instruments |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/kenya-law-mcp
```

## Usage

### As stdio MCP server

```bash
kenya-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "kenya-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/kenya-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a Kenyan Act |
| `search_legislation` | Full-text search across all Kenyan legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, Budapest Convention, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (Data Protection Act, Computer Misuse Act, Companies Act)
- 3 search tests (personal data, cybercrime, electronic transaction)
- 2 citation roundtrip tests (official URL patterns)
- 2 cross-reference tests (GDPR relationship, Budapest Convention)
- 2 negative tests (non-existent Act, malformed section)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/kenya-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
