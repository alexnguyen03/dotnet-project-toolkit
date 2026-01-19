# .NET Project Toolkit

**All-in-one project toolkit for .NET developers**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourpublisher/dotnet-project-toolkit)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🎯 Features

### ✅ v0.1.0 - Multi-View Panel Structure

The extension provides **4 dedicated views** in the Activity Bar for different .NET development tasks:

#### 📦 Publish View

- Hierarchical project structure (folders → projects → profiles)
- One-click deployment to UAT/PROD environments
- Deploy button on each publish profile
- PROD deployment confirmation dialog
- Deployment progress tracking
- Output channel logging

#### ⚡ Watch View _(Coming in v1.1)_

- Multiple watch instances management
- Hot-reload support
- Auto-attach debugger capability

#### 🐛 Debug View _(Coming in v1.1)_

- Debug configuration management
- Multi-session debugging
- Quick profile switching

#### 📜 History View _(Coming in v1.2)_

- Deployment history tracking
- Timeline visualization
- Rollback functionality

---

## 🚀 Getting Started

### Installation

1. **Install from VSIX** (Development):

   ```bash
   npm run compile
   # Press F5 to launch Extension Development Host
   ```

2. **From Marketplace** (When published):
   - Search for ".NET Project Toolkit" in VS Code Extensions
   - Click Install

### Quick Start

1. **Open a .NET workspace** containing .csproj files
2. **Click the .NET Toolkit icon** in the Activity Bar
3. **Select "Publish" tab** to see available deployment profiles
4. **Click the deploy button** 🚀 on any profile to start deployment

---

## 📖 Usage

### Publish View

The Publish view displays your solution structure with all available publish profiles:

```
📦 Publish
├── 📂 Server
│   ├── 🌐 BudgetControl.Server.Api
│   │   └── 📋 Profiles
│   │       ├── 📄 uat-api [UAT] 🚀
│   │       └── 📄 prod-api [PROD] ⚠️
│   └── 🌐 BudgetControl.Server.Web
│       └── 📋 Profiles
│           ├── 📄 uat-web [UAT] 🚀
│           └── 📄 prod-web [PROD] ⚠️
```

**To Deploy:**

1. Expand project folders to see publish profiles
2. Click the 🚀 icon next to any profile
3. For PROD deployments, confirm in the dialog
4. Monitor progress in the notification

---

## ⚙️ Configuration

### 🔐 Password Storage (Credentials)

The extension uses **VS Code SecretStorage** by default to store deployment credentials securely:

- **Windows**: Encrypted in Windows Credential Manager
- **macOS**: Encrypted in Keychain
- **Linux**: Encrypted in Secret Service API

**How to configure credentials:**

1. Click on a publish profile in the TreeView
2. Click "Edit" in the Profile Info panel
3. Enter your deployment password
4. Click "Save"

Passwords are automatically encrypted and stored securely. No manual environment variable setup required!

**Alternative: Environment Variables**

If you prefer to use environment variables (less secure, plain text):

```json
// .vscode/settings.json
{
  "dotnetToolkit.passwordStorage": "envvar"
}
```

📖 **See [PASSWORD_STORAGE.md](PASSWORD_STORAGE.md) for detailed information on password storage options.**

### Extension Settings

This extension contributes the following settings:

- `dotnetToolkit.passwordStorage`: Password storage method - `secret` (default, encrypted) or `envvar` (plain text)
- `dotnetToolkit.dotnetPath`: Path to dotnet CLI executable (default: `dotnet`)
- `dotnetToolkit.deploymentTimeout`: Deployment timeout in seconds (default: `300`)
- `dotnetToolkit.showNotifications`: Show deployment notifications (default: `true`)
- `dotnetToolkit.confirmProductionDeploy`: Confirm before deploying to production (default: `true`)
- `dotnetToolkit.historyMaxEntries`: Maximum deployment history entries (default: `50`)
- `dotnetToolkit.historyGroupByDate`: Group history by date (default: `true`)

---

## 🎨 Screenshots

### Multi-View Panel

![Multi-View Panel](media/multi-view-panel.png)

### Publish View

![Publish View](media/publish-view.png)

### Deploy Progress

![Deploy Progress](media/deploy-progress.png)

---

## 📝 Commands

The extension provides the following commands:

- `.NET Toolkit: Deploy to UAT - API`
- `.NET Toolkit: Deploy to UAT - Client`
- `.NET Toolkit: Deploy to Production - API`
- `.NET Toolkit: Deploy to Production - Client`
- `.NET Toolkit: Refresh Publish Profiles`
- `.NET Toolkit: Configure Environment Variables`

---

## 🗺️ Roadmap

### v1.0 - Core Deployment

- [x] Multi-view panel structure
- [x] Publish view with project hierarchy
- [x] Mock deployment workflow
- [ ] Real .pubxml file scanning
- [ ] Actual dotnet publish execution
- [ ] Environment variable validation

### v1.1 - Watch & Debug

- [ ] Watch view implementation
- [ ] Multiple watch instances
- [ ] Debug configuration management
- [ ] Auto-attach debugger to watch

### v1.2 - History & Advanced

- [ ] Deployment history tracking
- [ ] Rollback functionality
- [ ] Performance monitoring

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- npm 10+
- VS Code 1.108.1+

### Build & Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

### Project Structure

```
src/
├── extension.ts              # Main entry point
├── ui/
│   ├── publish/             # Publish view (implemented)
│   ├── watch/               # Watch view (placeholder)
│   ├── debug/               # Debug view (placeholder)
│   └── history/             # History view (placeholder)
├── deployment/              # Deployment logic
├── models/                  # Data models
└── utils/                   # Utilities
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourpublisher/dotnet-project-toolkit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourpublisher/dotnet-project-toolkit/discussions)

---

**Made with ❤️ for .NET developers**
