# Change Log

All notable changes to the ".NET Project Toolkit" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] - 2026-04-20

### Added

- ✨ **Profile Editor UI** - Webview panel for editing publish profiles with live preview
- 🔐 **Secure Credential Management** - VS Code SecretStorage API integration for encrypted password storage
- 📊 **IIS Log Viewer** - Download and view IIS logs directly from VS Code using MSDeploy
- 🌐 **Auto Browser Launch** - Automatically open browser after successful deployment (configurable)
- 📝 **Profile Info Panel** - Detailed profile information view with edit capabilities
- ⚙️ **Web.config Modifier** - Modify web.config settings during deployment
- 🎨 **Environment Badges** - Visual indicators for DEV/UAT/PROD environments
- 📅 **Smart History Grouping** - Group deployment history by date (Today, Yesterday, This Week, Older)
- 🔄 **Profile Refresh** - Manual refresh button for publish profiles
- 📋 **Custom Log Path** - Support for custom IIS log paths in publish profiles

### Changed

- 🎨 Improved UI/UX for profile management
- 📝 Enhanced profile creation wizard with validation
- 🔒 Default password storage changed to `secret` (encrypted) instead of `envvar`
- 📊 Better deployment progress notifications

### Fixed

- 🐛 Fixed profile save persistence issues
- 🐛 Fixed project path resolution in deployment
- 🐛 Fixed environment mapping for DEV/UAT/PROD
- 🐛 Fixed XML parsing for boolean values in `.pubxml` files

### Security

- 🔐 Implemented encrypted credential storage using OS keychain
- 🔐 Added production deployment confirmation dialog
- 🔐 Secure password handling throughout the extension

---

## [0.0.1] - 2026-01-14 (Internal Milestone, Not Released)

### Added

- 🎉 **Internal milestone build**
- 📦 Multi-view panel structure (Publish, Watch, Debug, History)
- 🚀 One-click deployment to IIS
- 📂 Automatic `.pubxml` file detection and parsing
- 🌳 Hierarchical project tree view
- ⚡ Watch management for multiple projects
- 🐛 Debug configuration management
- 📜 Deployment history tracking
- 🔧 Extension configuration settings
- 📝 Basic profile creation and deletion
- 🎯 Environment-based profile categorization (DEV/UAT/PROD)
- 📊 Real-time deployment progress tracking
- 📤 Output channel for deployment logs

### Features

- **Publish View**: Display all projects and their publish profiles
- **Watch View**: Manage multiple `dotnet watch` instances
- **Debug View**: Manage debug configurations and groups
- **History View**: Track deployment history with timestamps
- **Commands**: Deploy, create profile, delete profile, refresh, etc.
- **TreeView Integration**: Both Activity Bar and Explorer views

---

## [Unreleased]

### Planned for v0.2.0

- [ ] Enhanced error handling and recovery
- [ ] Deployment rollback functionality
- [ ] Multi-environment comparison tool
- [ ] Deployment templates and presets
- [ ] Batch deployment support
- [ ] Improved watch instance management
- [ ] Debug auto-attach to watch instances

### Planned for v1.0.0

- [ ] CI/CD pipeline integration
- [ ] Docker container support
- [ ] Azure App Service deployment
- [ ] Performance monitoring and profiling
- [ ] API endpoint testing integration
- [ ] Database migration management

---

## Version History

| Version | Date       | Description                                      |
| ------- | ---------- | ------------------------------------------------ |
| 0.1.0   | 2026-01-20 | First public release                             |
| 0.0.1   | 2026-01-14 | Internal development milestone (not released)    |

---

## Migration Guide

### First Public Release

This is the first public release of `.NET Project Toolkit`.

No migration is required.


---

## Breaking Changes

### v0.1.0

- None.

---

## Bug Fixes

### v0.1.0

- Fixed issue where `openBrowserOnDeploy` setting was not persisting
- Fixed project path resolution causing "Project path not found" errors
- Fixed environment name mapping for DEV/UAT/PROD profiles
- Fixed XML parser not handling boolean values correctly
- Fixed profile save not updating the TreeView immediately

### v0.0.1`r`n`r`n- Internal milestone - not publicly released.

---

## Known Issues

- Watch instances may not properly clean up on extension deactivation (restart VS Code if needed)
- Some IIS servers may require additional MSDeploy configuration for log download
- Large deployment outputs may cause performance issues in the Output panel

---

## Contributors

- **Alex Nguyen** ([@alexnguyen03](https://github.com/alexnguyen03)) - Creator and maintainer

---

## Links

- [GitHub Repository](https://github.com/alexnguyen03/dotnet-project-toolkit)
- [Issue Tracker](https://github.com/alexnguyen03/dotnet-project-toolkit/issues)
- [Changelog](https://github.com/alexnguyen03/dotnet-project-toolkit/blob/main/CHANGELOG.md)
- [License](https://github.com/alexnguyen03/dotnet-project-toolkit/blob/main/LICENSE)

---

**Note**: This extension is under active development. Features and APIs may change between versions.


