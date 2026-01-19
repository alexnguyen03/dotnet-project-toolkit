# .NET Project Toolkit

**All-in-one project toolkit for .NET developers - deployment, watch, and debug management**

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://github.com/alexnguyen03/dotnet-project-toolkit)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.95.0+-blue.svg)](https://code.visualstudio.com/)

---

## 📖 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Guide](#-usage-guide)
    - [Publish Profiles](#1-publish-profiles)
    - [Profile Management](#2-profile-management)
    - [Deployment](#3-deployment)
    - [Watch Management](#4-watch-management)
    - [Debug Management](#5-debug-management)
    - [Deployment History](#6-deployment-history)
- [Configuration](#️-configuration)
- [Security](#-security)
- [Development](#️-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Features

### ✅ **Publish & Deployment**

> ⚠️ **Note on Deployment Targets**: Currently, this extension **only supports IIS Web Deploy (MSDeploy)** via `.pubxml` profiles. Support for Docker, Azure App Service, SSH, or FTP is planned for future releases.

- 📦 **Automatic Profile Detection** - Scans workspace for `.pubxml` files and organizers them by project
- 🚀 **One-Click IIS Deployment** - Deploy to IIS servers (UAT/PROD/DEV) using existing publish profiles
- 🔐 **Secure Credential Management** - Encrypted password storage using VS Code SecretStorage API
- 📝 **Profile Editor** - Create, edit, and delete publish profiles with intuitive UI
- 🌐 **Auto Browser Launch** - Automatically opens browser after successful deployment
- 📊 **Real-time Progress** - Live deployment progress with detailed output logging
- 🔄 **IIS Log Viewer** - Download and view IIS logs directly from VS Code (requires MSDeploy)
- ⚙️ **Web.config Modifier** - Modify web.config settings during deployment

### ✅ **Watch Management (Local Dev)**

- 👁️ **Multi-Project Watch** - Run multiple `dotnet watch` instances simultaneously in integrated terminals
- 🎯 **Watch Groups** - Create and manage groups of projects to watch together (e.g., "Frontend + Backend")
- ▶️ **Individual Controls** - Start, stop, and restart watch instances independently
- 📋 **Status Tracking** - Visual indicators for running/stopped watch instances

### ✅ **Debug Management (Local Dev)**

- 🐛 **Debug Profiles** - Manage multiple debug configurations
- 🎮 **Debug Groups** - Group related debug sessions for microservices
- 🚀 **Quick Launch** - One-click debug session start
- 🔄 **Multi-Session Support** - Run multiple debug sessions simultaneously

### ✅ **Deployment History**

- 📜 **History Tracking** - Track all IIS deployments with timestamps and status
- 📅 **Smart Grouping** - Group history by date (Today, Yesterday, This Week, Older)
- 🗑️ **History Management** - Clear individual entries or entire history
- 📊 **Deployment Stats** - View deployment duration and success/failure status

---

## 📥 Installation

### From VSIX (Development)

1. Download the latest `.vsix` file from [Releases](https://github.com/alexnguyen03/dotnet-project-toolkit/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded `.vsix` file

### From VS Code Marketplace (Coming Soon)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for ".NET Project Toolkit"
4. Click **Install**

---

## 🚀 Quick Start

### 1. Open Your .NET Workspace

Open a folder containing .NET projects (`.csproj` files) in VS Code.

### 2. Access the Toolkit

Click the **.NET Toolkit** icon in the Activity Bar (left sidebar) or find it in the Explorer view.

### 3. View Your Projects

The extension automatically scans your workspace and displays:

- All .NET projects
- Publish profiles for each project
- Watch and debug configurations

### 4. Deploy in One Click

1. Expand a project to see its publish profiles
2. Click the 🚀 **Deploy** button next to any profile
3. Enter credentials if prompted (stored securely)
4. Monitor progress in the notification and output panel

---

## 📚 Usage Guide

### 1. Publish Profiles

#### Project Structure View

The extension displays your projects in a hierarchical tree:

```
📦 .NET Project Toolkit
├── 📂 Server
│   ├── 🌐 MyApp.Api
│   │   ├── 📄 DEV-API [DEV] 🚀
│   │   ├── 📄 UAT-API [UAT] 🚀
│   │   └── 📄 PROD-API [PROD] ⚠️
│   └── 🌐 MyApp.Web
│       ├── 📄 DEV-WEB [DEV] 🚀
│       └── 📄 UAT-WEB [UAT] 🚀
```

#### Environment Badges

- **DEV** - Development environment (green)
- **UAT** - User Acceptance Testing (yellow)
- **PROD** - Production environment (red)

### 2. Profile Management

#### Create New Profile

1. Right-click on a project
2. Select **Create Publish Profile**
3. Fill in the wizard:
    - Profile name
    - Environment (DEV/UAT/PROD)
    - Server URL
    - Site name
    - Username
    - Password (encrypted)
    - IIS log path (optional)
    - Auto-open browser option

#### Edit Existing Profile

1. Click on any publish profile
2. The **Profile Info Panel** opens
3. Click **Edit** to modify settings
4. Click **Save** to apply changes

#### Delete Profile

1. Right-click on a publish profile
2. Select **Delete Publish Profile**
3. Confirm deletion

### 3. Deployment

#### Deploy to Environment

**For DEV/UAT:**

1. Click the 🚀 icon next to the profile
2. Deployment starts automatically
3. Monitor progress in the notification

**For PROD:**

1. Click the 🚀 icon next to the PROD profile
2. **Confirmation dialog appears** (safety feature)
3. Confirm to proceed
4. Deployment starts

#### Deployment Process

1. **Build** - Compiles the project
2. **Publish** - Creates deployment package
3. **Deploy** - Uploads to IIS via MSDeploy
4. **Verify** - Checks deployment status
5. **Launch** - Opens browser (if enabled)

#### View Deployment Output

- Check the **Output** panel (View → Output)
- Select ".NET Toolkit" from the dropdown
- View real-time deployment logs

### 4. Watch Management

#### Start Watch Instance

1. Navigate to the **Watch** view
2. Find your project under "Projects"
3. Click the ▶️ **Play** button
4. Watch instance starts with hot-reload enabled

#### Create Watch Group

1. Click the ➕ icon in the Watch view
2. Enter group name
3. Select projects to include
4. Click **Create**

#### Run Watch Group

1. Find your group under "Watch Groups"
2. Click the ▶️ **Play** button
3. All projects in the group start watching

#### Stop Watch Instance

- Click the ⏹️ **Stop** button next to running instance
- Or use **Stop All Watches** to stop everything

### 5. Debug Management

#### Create Debug Group

1. Navigate to the **Debug** view
2. Click the ➕ icon
3. Enter group name
4. Select projects to debug together
5. Click **Create**

#### Start Debug Session

1. Find your debug profile or group
2. Click the 🐛 **Debug** button
3. Debug session launches

#### Stop Debug Session

- Click the ⏹️ **Stop** button next to running session
- Or use **Stop All Debugging**

### 6. Deployment History

#### View History

1. Navigate to the **History** view
2. See all deployments grouped by date:
    - Today
    - Yesterday
    - This Week
    - Older

#### History Entry Details

Each entry shows:

- 🚀 Project name and profile
- ⏱️ Deployment time
- ✅ Success or ❌ Failure status
- ⏳ Duration

#### Clear History

- **Clear Single Entry**: Click ❌ next to an entry
- **Clear All**: Click the 🗑️ icon in the view title

---

## ⚙️ Configuration

### Extension Settings

Access settings via `File → Preferences → Settings` and search for "dotnet toolkit":

| Setting                             | Type    | Default | Description                                               |
| ----------------------------------- | ------- | ------- | --------------------------------------------------------- |
| `dotnetToolkit.passwordStorage`     | string  | secret  | Password storage method: `secret` (encrypted) or `envvar` |
| `dotnetToolkit.openBrowserOnDeploy` | boolean | true    | Automatically open browser after successful deployment    |
| `dotnetWorkspace.dotnetPath`        | string  | dotnet  | Path to dotnet CLI executable                             |

---

## 🔐 Security

### Credential Storage

The extension uses **VS Code SecretStorage API** by default for maximum security:

| Platform | Storage Location               |
| -------- | ------------------------------ |
| Windows  | Windows Credential Manager     |
| macOS    | Keychain                       |
| Linux    | Secret Service API (libsecret) |

**Benefits:**

- ✅ Encrypted at rest
- ✅ OS-level security
- ✅ No plaintext passwords
- ✅ Per-workspace isolation

### Alternative: Environment Variables

If you prefer environment variables (less secure):

1. Set `dotnetToolkit.passwordStorage` to `envvar`
2. Create environment variables:
    ```
    DEPLOY_PASSWORD_<PROFILE_NAME>=your_password
    ```

⚠️ **Warning**: Environment variables are stored in plaintext and are less secure.

📖 **See [PASSWORD_STORAGE.md](PASSWORD_STORAGE.md) for detailed information.**

### Production Deployment Safety

- ✅ Confirmation dialog required for PROD deployments
- ✅ Environment badges clearly indicate PROD profiles
- ✅ Deployment history tracks all production deployments
- ✅ Configurable confirmation setting

---

## 🛠️ Development

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **VS Code** 1.95.0 or higher
- **.NET SDK** 6.0 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/alexnguyen03/dotnet-project-toolkit.git
cd dotnet-project-toolkit

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

### Build & Package

```bash
# Type check
npm run check-types

# Lint code
npm run lint

# Format code
npm run format

# Build production bundle
npm run package

# Run tests
npm test
```

### Code Formatting

This project uses **EditorConfig** and **Prettier** for consistent code formatting:

```bash
# Check formatting
npm run format:check

# Auto-format all files
npm run format
```

### Debug Extension

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new VS Code window

### Project Structure

```
src/
├── extension.ts              # Main entry point
├── commands/                 # Command implementations
│   ├── CreateProfileCommand.ts
│   ├── DeleteProfileCommand.ts
│   ├── DeployCommand.ts
│   ├── EditProfileCommand.ts
│   └── ...
├── services/                 # Business logic
│   ├── DeploymentService.ts
│   ├── ProfileService.ts
│   ├── CredentialService.ts
│   ├── LogViewerService.ts
│   └── ...
├── ui/                       # UI components
│   ├── PublishTreeProvider.ts
│   ├── WatchTreeProvider.ts
│   ├── DebugTreeProvider.ts
│   ├── HistoryTreeProvider.ts
│   └── ProfileInfoPanel.ts
├── models/                   # Data models
│   ├── ProjectModels.ts
│   ├── DeploymentModels.ts
│   └── ...
├── parsers/                  # File parsers
│   ├── PubxmlParser.ts
│   └── ...
├── generators/               # File generators
│   ├── PubxmlGenerator.ts
│   └── ...
└── utils/                    # Utilities
    ├── PathUtils.ts
    └── ...
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Deployment Fails with "Project path not found"

**Solution:**

- Ensure the `.csproj` file exists
- Refresh the publish profiles (click refresh icon)
- Check that the project is in the workspace

#### 2. Credentials Not Saving

**Solution:**

- Check that `dotnetToolkit.passwordStorage` is set to `secret`
- Verify OS keychain/credential manager is accessible
- Try switching to `envvar` mode temporarily

#### 3. Browser Doesn't Open After Deployment

**Solution:**

- Check that `dotnetToolkit.openBrowserOnDeploy` is `true`
- Verify the profile has a valid site URL
- Check the profile's `openBrowserOnDeploy` setting in the editor

#### 4. Watch Instance Won't Start

**Solution:**

- Ensure `dotnet` CLI is in PATH
- Check that the project builds successfully
- Verify no port conflicts exist

#### 5. IIS Logs Not Downloading

**Solution:**

- Verify the log path is correct in the profile
- Check MSDeploy credentials are valid
- Ensure the IIS log directory exists on the server

### Enable Debug Logging

1. Open Output panel (View → Output)
2. Select ".NET Toolkit" from dropdown
3. View detailed logs for troubleshooting

### Get Help

- 🐛 [Report a Bug](https://github.com/alexnguyen03/dotnet-project-toolkit/issues)
- 💡 [Request a Feature](https://github.com/alexnguyen03/dotnet-project-toolkit/issues)
- 💬 [Ask a Question](https://github.com/alexnguyen03/dotnet-project-toolkit/discussions)

---

## 🗺️ Roadmap

### ✅ v0.1.x (Current)

- ✅ **Core IIS Deployment (MSDeploy)**
- ✅ Watch & Debug Management (Local)
- ✅ Credential Management
- ✅ Deployment History
- ✅ IIS Log Viewer

### 🚧 v0.2.0 (Planned)

- [ ] **Deployment Rollback** (IIS)
- [ ] Enhanced Error Handling & Diagnostics
- [ ] Multi-environment Comparer (Diff configs)
- [ ] Batch Deployment (Deploy multiple apps at once)

### 🔮 Future (v1.0+)

- [ ] **Docker Support** (Build & Push)
- [ ] **Azure App Service** Deployment
- [ ] **SSH/SFTP** Deployment Generic
- [ ] CI/CD Pipeline Integration (GitHub Actions)
- [ ] Database Migration Tools

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style
- Run `npm run format` before committing
- Add tests for new features
- Update documentation as needed

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with ❤️ for the .NET developer community
- Powered by [VS Code Extension API](https://code.visualstudio.com/api)
- Uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for `.pubxml` parsing

---

## 📞 Support

- **GitHub**: [alexnguyen03/dotnet-project-toolkit](https://github.com/alexnguyen03/dotnet-project-toolkit)
- **Issues**: [Report a Bug](https://github.com/alexnguyen03/dotnet-project-toolkit/issues)
- **Discussions**: [Community Forum](https://github.com/alexnguyen03/dotnet-project-toolkit/discussions)

---

**Made with ❤️ for .NET developers**

_Simplify your .NET development workflow - deploy, watch, and debug with ease!_
