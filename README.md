# Time Series panel for Grafana

![Grafana 10](https://img.shields.io/badge/Grafana-10.0-orange)
![CI](https://github.com/volkovlabs/volkovlabs-timeseries-panel/workflows/CI/badge.svg)
![E2E](https://github.com/volkovlabs/volkovlabs-timeseries-panel/workflows/E2E/badge.svg)
[![CodeQL](https://github.com/VolkovLabs/volkovlabs-timeseries-panel/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/VolkovLabs/volkovlabs-timeseries-panel/actions/workflows/codeql-analysis.yml)

## Introduction

The Time Series panel is a native Grafana panel decoupled from the core.

## Requirements

- **Grafana 10** is required for major version 1.

## Getting Started

1. Install packages

```bash
npm install
```

2. Build the plugin

```bash
npm run build
```

3. Sign the plugins if required

```bash
export GRAFANA_ACCESS_POLICY_TOKEN=erfdfsgfs==
npm run sign
```

4. Start the Docker container

```bash
npm run start
```

## Highlights

- Based on the native Time Series panel from 10.0.3.
- Allows to select a dashboard variable to automatically add to manual annotations.
- Allows to set custom scales using the datasource (Timescale) for viewers.

## Support

- Subscribe to our [YouTube Channel](https://www.youtube.com/@volkovlabs) and add a comment.
- Premium support for the development plugins is available via [GitHub Sponsor](https://github.com/sponsors/VolkovLabs).

## License

GNU AFFERO GENERAL PUBLIC LICENSE 3, see [LICENSE](https://github.com/volkovlabs/volkovlabs-timeseries-panel/blob/main/LICENSE).
