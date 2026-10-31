# Vortex & Omni Cloud Hub — 24/7 Google Cloud Production Platform (`me-west1`)

**Live Production Platforms:**
- **Vortex Cloud & FinOps:** [https://vortex-cloud-finops.web.app](https://vortex-cloud-finops.web.app)
- **HIT Cloud OS (Academic LMS Sync & AI Mentor):** [https://hazav-hit-academy.web.app](https://hazav-hit-academy.web.app)
- **Dreamoments AI (Real-Time Voice & Calendar Concierge):** [https://dreamoments-ai.web.app](https://dreamoments-ai.web.app)
- **Aurelia (Trilingual `HE/EN/RU` Client Platform):** [https://aurelia-rare-books.web.app](https://aurelia-rare-books.web.app)

**Author:** Hazav Ogdan — *Google Cloud Certified Professional Cloud Architect* ([Verify on Credly](https://www.credly.com/badges/08f692b6-e4db-493c-9045-adf99fbb9e0d) · [Google Skills Profile](https://www.skills.google/public_profiles/9693e186-06ec-49bd-a65c-5a17f7a9afad))

---

## Executive Overview

**Omni Cloud Hub & Vortex** is a 7-layer, 24/7 production Google Cloud infrastructure and multi-service automation ecosystem deployed in **Tel Aviv (`me-west1`)**.

It connects containerized **Google Cloud Run** microservices (running as non-root Docker containers) to a persistent **Compute Engine Ubuntu 24.04 VM** (`me-west1-a`) over private **Direct VPC Egress** (`10.208.0.2`), backed by **Cloud Firestore Native** (with 7-day Point-in-Time Recovery & Delete Protection), **BigQuery** analytics pipelines, **Pub/Sub**, keyless **Workload Identity + Secret Manager** authentication, and native **Google Cloud Operations & Security Suite** monitoring (**Cloud Logging**, **Error Reporting**, **Security Command Center**, and **Uptime Checks**).

---

## 7-Layer Production Architecture (`me-west1`)

```mermaid
flowchart TB
  Clients["6 Live Web Platforms (Firebase Hosting CDN & Direct REST API Deploy)"] -->|HTTPS / WSS 16-24kHz PCM| CloudRun["Google Cloud Run (me-west1 · Non-Root Docker · 4 vCPU / 4 GiB)"]
  CloudRun -->|Private Direct VPC Egress (10.208.0.2:8787)| GCE["Compute Engine Ubuntu 24.04 VM (me-west1-a · systemd Gateway)"]
  CloudRun -->|Real-Time State & PITR| Firestore["Cloud Firestore Native (PITR + Delete Protection)"]
  GCE -->|Streaming Analytics| BigQuery["Google BigQuery (hazav_empire_analytics)"]
  Scheduler["Cloud Scheduler (OIDC Auth) + Cloud Tasks"] -->|/cron/tick| CloudRun
  SecretMgr["Google Secret Manager (20 Runtime Secrets · Workload Identity)"] -.->|0 Static Keys + Auto 401 Refresh| CloudRun
  SecretMgr -.->|Workload Identity| GCE
  Ops["Cloud Logging + Error Reporting + Security Command Center (15m Audit) + Uptime Checks"] -.->|24/7 Telemetry & Alerts| CloudRun
  Ops -.->|Real-Time Incident Alerts| Telegram["7 Telegram Operations Bots & WhatsApp Bridge"]
```

---

## Core Engineering Highlights

### 1. Compute, Private Networking & Containers (`Cloud Run` + `Compute Engine` + `Direct VPC Egress`)
- **Non-Root Multi-Stage Docker Containers:** Hardened Python `asyncio` microservices deployed to **Google Cloud Run** (`me-west1`) via **Google Cloud Build CI/CD** (`cloudbuild.yaml`).
- **Private VPC Routing:** Cloud Run communicates directly with the persistent **Ubuntu 24.04 VM** (`me-west1-a`) over internal RFC1918 networking (`10.208.0.2`) using **Direct VPC Egress**, with legacy exposed ports (`RDP 3389`) removed from VPC firewall rules.
- **Direct Firebase Hosting REST API Deployer:** Custom zero-CLI deployment engine for **HIT Cloud OS** (`hazav-hit-academy.web.app`) that hashes (`SHA-256`), gzips, uploads blobs, and finalizes atomic releases directly against the Firebase Hosting REST API.

### 2. Security, Keyless Identity & Incident Remediation (`Secret Manager` + `SCC`)
- **Zero Static Keys:** All 20 runtime credentials are retrieved dynamically via **Workload Identity / Metadata Server** from **Google Secret Manager**, with transparent token refresh on `HTTP 401`.
- **Production Credential Rotation Case Study:** Executed end-to-end remediation of an exposed client-side bot token—revoked the compromised token, scrubbed 9 source files, migrated alerting behind a server-side Cloud Run proxy, and enforced least-privilege **Cloud IAM**.
- **Automated 15-Minute SecOps Audits:** Integrated **Google Cloud Security Command Center (SCC)**, **Cloud Logging**, **Cloud Error Reporting**, and **Cloud Monitoring Uptime Checks** with real-time Telegram incident alerting.

### 3. Resilience, Data Protection & Self-Healing Automation
- **Database Disaster Recovery:** Enabled **Point-in-Time Recovery (PITR)** (7-day window) and **Delete Protection** on **Cloud Firestore Native**, paired with automated streaming to **Google BigQuery**.
- **AI Circuit Breaker Router:** Resilient multi-provider routing gateway with health state tracking, automatic OAuth refresh, and instant failover across cloud inference endpoints.
- **Self-Healing OS Daemons & 35/35 E2E Verification:** Protected by `systemd` services, macOS `LaunchAgents`, self-healing `cron` watchdogs, 6-hour automated **20TB Google Drive** backups, and a **35-test end-to-end production test suite**.

---

## Related Public Repositories

- **[soc-home-labs](https://github.com/kingbob2205/soc-home-labs):** 9 production-style Linux NOC/SOC troubleshooting scenarios (`nginx` port conflict, disk full, CPU spike, memory leak, `netns` routing, loopback bind, `iptables DROP` via `tcpdump`, DNS failure, hidden C2 process) with full root-cause reports.
- **[soc-ssh-detection-lab](https://github.com/kingbob2205/soc-ssh-detection-lab):** Reproducible Kali/Ubuntu SSH brute-force detection & response lab using **Splunk SPL** (SIEM alerts & dashboards) and automated **Fail2ban + nftables** IP containment.
- **[gcp-fabric-foundation](https://github.com/kingbob2205/gcp-fabric-foundation):** Modular **Terraform** Google Cloud foundation (`dev`/`prod` isolated VPCs, Cloud NAT, Private Google Access, IAP-only SSH).
- **[google-cloud-labs-portfolio](https://github.com/kingbob2205/google-cloud-labs-portfolio):** 22 documented hands-on Google Cloud infrastructure labs (GKE autoscaling, HTTP/Network Load Balancers, Cloud DNS geolocation routing, IAM, KMS, Cloud SQL, Spanner).
