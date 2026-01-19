# .NET Project Toolkit

**All-in-one project toolkit for .NET developers - deployment, watch, and debug management**

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://github.com/alexnguyen03/dotnet-project-toolkit)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
    - [Publish Profiles](#1-publish-profiles)
    - [Profile Management](#2-profile-management)
    - [Deployment](#3-deployment)
    - [View Logs](#4-view-logs)
    - [Watch Management](#5-watch-management)
    - [Debug Management](#6-debug-management)
    - [Deployment History](#7-deployment-history)
- [Configuration](#configuration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Features

### Publish & Deployment

> **Note**: Currently supports **IIS Web Deploy (MSDeploy)** via `.pubxml` profiles. Docker and other targets are planned.

- **Profile Detection**: Scans workspace for `.pubxml` files per project.
- **IIS Deployment**: One-click deploy to Staging, Production, or Dev environments.
- **Credential Management**: Securely encrypted password storage.
- **Profile Editor**: Direct UI for managing publish profiles.
- **Auto Browser Launch**: Opens site after successful deployment.
- **IIS Log Viewer**: Download and view logs from the server.
- **Web.config Modifier**: Adjust settings during deployment.

### Watch & Debug (Local Dev)

- **Multi-Project Watch**: Run multiple `dotnet watch` instances.
- **Groups**: Manage sets of projects (e.g., "Full Stack") to watch or debug together.
- **Status Tracking**: Visual indicators for running processes.

### Deployment History

- **Tracking**: Log of all deployments with status and duration.
- **Organization**: Grouped by date (Today, Yesterday, etc.).

---

## Installation

1. Download the latest `.vsix` from [Releases](https://github.com/alexnguyen03/dotnet-project-toolkit/releases).
2. Open VS Code, press `Ctrl+Shift+P`, and run **Extensions: Install from VSIX**.

---

## Quick Start

1. **Open Workspace**: Open a folder with your .NET projects.
2. **Access Toolkit**: Click the **.NET Toolkit** icon in the Activity Bar.
3. **Deploy**: Expand a project, find a profile, and click the **Deploy** (rocket) icon.

---

## Usage Guide

### 1. Publish Profiles

The extension organizes profiles hierarchically:

```
📦 .NET Project Toolkit
├── 📂 Server
│   ├── 🌐 MyApp.Api
│   │   ├── 📄 DEV-API [DEV]
│   │   ├── 📄 STAGING-API [STAGING]
│   │   └── 📄 PROD-API [PROD]
```

**Environment Badges:**

- **DEV**: Development (Green)
- **STAGING**: Staging (Blue)
- **PROD**: Production (Red)

### 2. Profile Management

**Create Profile:**
Right-click a project -> **Create Publish Profile**.

- **Environments**: DEV, STAGING, PROD.
- **Log Path**: Optional path to IIS stdout logs.

**Edit Profile:**
Click any profile to open the **Profile Info Panel**.

- Modify URL, credentials, or settings.
- Enable **Open in browser** or **Stdout logging**.

### 3. Deployment

**Deploy to Staging/Dev:**
Click the **Deploy** icon next to the profile.

**Deploy to Production:**
Click **Deploy**. A confirmation dialog is required for safety.

**Process:**
Build -> Publish -> Deploy (MSDeploy) -> Verify -> Launch Browser.

### 4. View Logs

View IIS stdout logs directly within VS Code:

1. Open a publish profile to view the **Profile Info Panel**.
2. Scroll to **Deployment Options**.
3. Ensure **Log Path** is set (e.g., `C:\inetpub\logs\LogFiles\W3SVC1`).
4. Click the **View Logs** button.
5. Logs are downloaded and displayed in the Output panel.

### 5. Watch Management

- **Start**: Click Play on a project or group.
- **Groups**: Click `+` to create a group of projects to watch simultaneously.

### 6. Debug Management

- **Debug**: Click Debug icon on a project or group to attach debugger.
- **Groups**: Create groups to debug microservices together.

### 7. Deployment History

View past deployments in the **History** view.

- Shows status (Success/Failure) and duration.

---

## Configuration

**Settings (`Ctrl+,` -> search "dotnet toolkit"):**

| Setting                             | Default  | Description                                                   |
| :---------------------------------- | :------- | :------------------------------------------------------------ |
| `dotnetToolkit.passwordStorage`     | `secret` | Use `secret` (encrypted) or `envvar` (environment variables). |
| `dotnetToolkit.openBrowserOnDeploy` | `true`   | Open browser after deployment.                                |
| `dotnetWorkspace.dotnetPath`        | `dotnet` | Path to dotnet CLI.                                           |

---

## Security

- **Credentials**: Stored using OS-secure storage (Credential Manager/Keychain) by default.
- **Production Safety**: Explicit confirmation required for PROD deployments.

---

## Troubleshooting

- **Project Not Found**: Ensure `.csproj` builds successfully. Refresh the view.
- **Credentials**: If saving fails, check if your OS Keychain is unlocked.
- **Logs**: If logs are empty, verify the **Log Path** on the server and ensure the user has read permissions.

---

## 🤝 Contributing

Contributions are always welcome!

- **Report Bugs**: Open an issue to report bugs or request features.
- **Submit PRs**: Fork the repo, simplify your workflow, and submit a Pull Request.

---

## ☕ Support Me

If you find this extension helpful, consider supporting its development!

- [Ko-fi](https://ko-fi.com/alexnguyen03)
- [Paypal](https://paypal.me/alexnguyeen03)

**Made with ❤️ for .NET developers**
