# .NET Project Toolkit - Feature Plan

**Extension Name**: .NET Project Toolkit  
**Extension ID**: `yourpublisher.dotnet-project-toolkit`  
**Tagline**: All-in-one project toolkit for .NET developers  
**Target Audience**: .NET Core/ASP.NET Core developers using VS Code

---

## 🎯 Vision

A comprehensive VS Code extension that streamlines the entire .NET development workflow - from development and debugging to deployment. This extension eliminates the need for multiple terminal commands and manual configuration by providing an intuitive UI for common .NET development tasks.

---

## 📋 Feature Roadmap

### **v1.0 - Core Deployment** 🚀 (MVP)

#### 1. IIS Deployment Management

- ✅ **Publish Profile Detection**

  - Auto-scan workspace for `.pubxml` files
  - Categorize by environment (UAT, PROD, DEV)
  - Categorize by type (API, Web, Worker)
  - Display in TreeView with grouping

- ✅ **One-Click Deployment**

  - Deploy to UAT/PROD with single click
  - Support for API and Web projects
  - Real-time deployment progress
  - Deployment output streaming to Output panel

- ✅ **Credential Management**

  - Secure password storage (VS Code SecretStorage API)
  - Per-profile credential management
  - Auto-prompt for missing credentials
  - Credential update/delete functionality

- ✅ **MSDeploy/Web Deploy Integration**

  - Execute `dotnet publish` with MSBuild parameters
  - Support for all publish profile settings
  - Handle deployment failures gracefully
  - Deployment history tracking

- ✅ **Notification System**
  - Success/failure notifications
  - Optional integration with external notification tools
  - Deployment summary (time, status, target)

---

### **v1.1 - Watch & Debug Management** 🐛

#### 2. Multiple Watch Instances

- ✅ **Multi-Project Watch**

  - Watch multiple projects simultaneously
  - Individual start/stop/restart controls
  - Port management and conflict detection
  - Environment variable configuration per instance

- ✅ **Watch Instance Manager UI**

  - TreeView showing all running watch instances
  - Color-coded status indicators (running/stopped/error)
  - Quick actions: start, stop, restart, view logs
  - Resource usage monitoring (optional)

- ✅ **Watch Configuration Templates**
  - Save/load watch configurations
  - Quick-start presets (e.g., "API + Web", "Full Stack")
  - Share configurations across team
  - Configuration versioning

#### 3. Debug Configuration Management

- ✅ **Multiple Debug Instances**

  - Configure multiple debug profiles
  - Launch multiple debug sessions simultaneously
  - Debug instance grouping (e.g., "Microservices")
  - Quick-switch between debug profiles

- ✅ **Debug Profile Templates**

  - Pre-built templates for common scenarios
  - ASP.NET Core API debugging
  - Blazor Server/WASM debugging
  - Remote debugging configurations
  - Docker container debugging

- ✅ **Debug Instance UI**
  - TreeView for all debug configurations
  - One-click launch from TreeView
  - Edit/duplicate/delete profiles
  - Import/export debug configurations

#### 4. Attach to Debugger While Watching ⭐ **NEW FEATURE**

- ✅ **Auto-Attach on Watch**

  - Automatically attach debugger when watch starts
  - Configurable attach delay (wait for app startup)
  - Hot-reload with debugger attached
  - Breakpoint preservation across restarts

- ✅ **Manual Attach Controls**

  - "Attach Debugger" button in Watch Instance UI
  - Detach without stopping watch
  - Re-attach after detach
  - Process picker for multi-process scenarios

- ✅ **Smart Attach**
  - Detect process automatically by port/name
  - Handle process restart gracefully
  - Auto-reattach on process crash/restart
  - Support for Kestrel and IIS Express

---

### **v1.2 - Project Management** 📦

#### 5. Solution & Project Tools

- ✅ **Multi-Project Build**

  - Build multiple projects in parallel
  - Build order optimization
  - Incremental build support
  - Build output aggregation

- ✅ **NuGet Package Management**

  - Update packages across solution
  - View outdated packages
  - Bulk package updates
  - Package vulnerability scanning

- ✅ **Project References Viewer**
  - Visual dependency tree
  - Circular dependency detection
  - Quick navigation between projects

---

### **v2.0 - Advanced Features** 🚀

#### 6. Database & Migration Tools

- ✅ **EF Core Migration Manager**

  - Create/apply migrations from UI
  - Migration history viewer
  - Rollback functionality
  - Multi-database support

- ✅ **Database Seeding**
  - Run seed data scripts
  - Environment-specific seeding
  - Seed data templates

#### 7. API Testing Integration

- ✅ **Endpoint Explorer**
  - Auto-discover API endpoints
  - Generate HTTP requests
  - Test API directly from VS Code
  - Save request collections

#### 8. Performance & Monitoring

- ✅ **Performance Profiling**

  - CPU/Memory profiling integration
  - dotnet-trace integration
  - Performance bottleneck detection

- ✅ **Health Check Monitoring**
  - Monitor running instances
  - Health endpoint polling
  - Alert on failures

---

## 🎨 User Interface Components

### Activity Bar Icon

- Custom icon in Activity Bar
- Badge showing active watches/deployments
- Quick access to main features

### TreeViews

1. **Publish Profiles** - All deployment profiles
2. **Watch Instances** - Running watch sessions
3. **Debug Profiles** - Debug configurations
4. **Deployment History** - Recent deployments

### Status Bar

- Active watch count
- Last deployment status
- Quick action buttons

### Command Palette Commands

```
.NET Toolkit: Deploy to...
.NET Toolkit: Start Watch
.NET Toolkit: Start Watch with Debugger
.NET Toolkit: Stop All Watches
.NET Toolkit: Configure Debug Profile
.NET Toolkit: Attach Debugger to Watch
.NET Toolkit: View Deployment History
.NET Toolkit: Manage Credentials
```

### Context Menus

- Right-click on publish profile → Deploy, Configure, Delete
- Right-click on watch instance → Stop, Restart, Attach Debugger, View Logs
- Right-click on debug profile → Launch, Edit, Duplicate, Delete

---

## 🔧 Technical Architecture

### Core Modules

```
src/
├── extension.ts                    # Main entry point
├── deployment/
│   ├── profileScanner.ts          # Scan and parse .pubxml files
│   ├── deploymentEngine.ts        # Execute dotnet publish
│   ├── credentialManager.ts       # Secure credential storage
│   └── deploymentHistory.ts       # Track deployment history
├── watch/
│   ├── watchManager.ts            # Manage watch instances
│   ├── processManager.ts          # Start/stop dotnet watch
│   ├── portManager.ts             # Port allocation and conflict detection
│   └── watchConfigManager.ts      # Save/load watch configurations
├── debug/
│   ├── debugProfileManager.ts     # Manage debug configurations
│   ├── debugAttacher.ts           # Attach debugger to processes
│   ├── autoAttach.ts              # Auto-attach logic
│   └── processDetector.ts         # Detect running .NET processes
├── views/
│   ├── profileTreeProvider.ts     # Publish profiles TreeView
│   ├── watchTreeProvider.ts       # Watch instances TreeView
│   ├── debugTreeProvider.ts       # Debug profiles TreeView
│   └── historyTreeProvider.ts     # Deployment history TreeView
├── ui/
│   ├── statusBar.ts               # Status bar integration
│   └── quickPick.ts               # Quick pick menus
└── utils/
    ├── dotnetCli.ts               # dotnet CLI wrapper
    ├── configManager.ts           # Extension configuration
    └── logger.ts                  # Logging utility
```

---

## 🔐 Security Features

1. **Credential Storage**

   - Use VS Code SecretStorage API
   - No plaintext passwords in settings
   - Per-workspace credential isolation

2. **Deployment Safety**

   - Confirmation prompt for PROD deployments
   - Deploy lock mechanism (prevent concurrent deploys)
   - Rollback capability (future)

3. **Process Isolation**
   - Each watch instance runs in separate process
   - No cross-instance interference
   - Proper cleanup on extension deactivation

---

## 📊 Success Metrics

### v1.0 Goals

- ✅ 100 active users in first month
- ✅ 4.0+ rating on marketplace
- ✅ <5% deployment failure rate

### v1.1 Goals

- ✅ 500 active users
- ✅ Support for watch + debugger in 90% of scenarios
- ✅ <10s average attach time

### v2.0 Goals

- ✅ 1000+ active users
- ✅ Become top .NET productivity extension
- ✅ Enterprise adoption

---

## 🚀 Development Timeline

### Phase 1: Foundation (Weeks 1-2)

- [ ] Setup extension project with TypeScript
- [ ] Implement publish profile scanner
- [ ] Build basic deployment engine
- [ ] Create credential manager

### Phase 2: Deployment MVP (Weeks 3-4)

- [ ] Complete deployment features
- [ ] Build UI TreeViews
- [ ] Implement notification system
- [ ] Testing and bug fixes

### Phase 3: Watch Management (Weeks 5-6)

- [ ] Implement watch manager
- [ ] Multi-instance support
- [ ] Port management
- [ ] Configuration templates

### Phase 4: Debug Integration (Weeks 7-8)

- [ ] Debug profile manager
- [ ] Auto-attach implementation
- [ ] Process detection
- [ ] Testing with various .NET project types

### Phase 5: Polish & Release (Week 9-10)

- [ ] Documentation (README, USAGE, TROUBLESHOOTING)
- [ ] Screenshots/demos/GIFs
- [ ] Marketplace preparation
- [ ] Beta testing
- [ ] v1.0 Release

---

## 🎯 Key Use Cases

### Use Case 1: Quick Deployment

**Scenario**: "As a developer, I want to deploy my API to UAT with one click, so I don't have to remember complex dotnet publish commands."

**Solution**: Select profile from TreeView → Click deploy → Done!

---

### Use Case 2: Multi-Project Development

**Scenario**: "As a full-stack developer, I want to run both my API and Blazor app simultaneously with hot-reload, so I can develop efficiently."

**Solution**:

- Start API watch instance (port 5000)
- Start Web watch instance (port 5001)
- Both run with hot-reload
- View logs in separate Output channels

---

### Use Case 3: Debug While Developing

**Scenario**: "As a developer, I want to attach the debugger to my watch session without restarting, so I can investigate issues quickly."

**Solution**:

- Start watch instance
- Click "Attach Debugger" button
- Debugger attaches to running process
- Set breakpoints and debug
- Detach when done, watch continues running

---

### Use Case 4: Team Consistency

**Scenario**: "As a team lead, I want to share watch and debug configurations with my team, so everyone uses the same development setup."

**Solution**:

- Create watch/debug configuration templates
- Export to `.vscode/dotnet-workspace.json`
- Commit to repository
- Team members import and use

---

## 💡 Future Ideas (Beyond v2.0)

### CI/CD Integration

- Trigger GitHub Actions/Azure Pipelines from VS Code
- View pipeline status in extension
- Deploy artifact from pipeline to IIS

### Container Support

- Build Docker images
- Deploy to container registries
- Kubernetes deployment integration

### Cloud Integration

- Azure Functions deployment
- Azure App Service deployment
- AWS Lambda deployment

### Advanced Debugging

- Enhanced Blazor WASM debugging
- Multi-target debugging (browser + server)
- Time-travel debugging integration

### Testing Tools

- gRPC client for testing
- SignalR hub testing
- WebSocket testing
- Load testing integration

### Monitoring & Observability

- Aggregate logs from multiple instances
- Distributed tracing viewer
- Application Insights integration
- Performance comparison tool

---

## 📚 Documentation Structure

### README.md

- Feature overview with screenshots
- Installation guide
- Quick start (5-minute tutorial)
- Requirements checklist

### USAGE.md

- Detailed feature documentation
- Configuration reference
- Best practices
- Advanced scenarios

### TROUBLESHOOTING.md

- Common issues and solutions
- FAQ
- Enable debug logging
- Support channels

### CONTRIBUTING.md

- Development setup
- Code style guide
- Pull request process
- Testing requirements

---

## 🤝 Community & Support

- **Repository**: Open source on GitHub (MIT License)
- **Issue Tracker**: Bug reports and feature requests
- **Discussions**: Community Q&A
- **Documentation Site**: Comprehensive guides and tutorials
- **Discord/Slack**: Real-time support (optional)

---

## 📝 Notes & Decisions

### Why ".NET Workspace Manager"?

- ✅ Broad enough to encompass all features
- ✅ Professional and searchable
- ✅ Clear value proposition
- ✅ Room for future expansion

### Technology Choices

- **TypeScript**: Type safety and better IntelliSense
- **VS Code API**: Native integration
- **SecretStorage API**: Secure credential management
- **Child Process**: Reliable process management

### Design Principles

1. **Simplicity First**: Complex tasks made simple
2. **Visual Feedback**: Always show progress and status
3. **Safety**: Prevent destructive actions with confirmations
4. **Performance**: Fast startup, responsive UI
5. **Extensibility**: Plugin architecture for future features

---

**Last Updated**: 2026-01-14  
**Status**: Planning Phase  
**Next Milestone**: v1.0 MVP - IIS Deployment

---

## 🚦 Next Steps

1. ✅ Confirm extension name → **DONE**
2. ✅ Create comprehensive feature plan → **DONE**
3. ⏭️ Initialize extension project with Yeoman
4. ⏭️ Setup TypeScript and project structure
5. ⏭️ Begin Phase 1: Foundation
