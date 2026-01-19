# Contributing to .NET Project Toolkit

First off, thank you for considering contributing to .NET Project Toolkit! 🎉

It's people like you that make this extension better for the entire .NET developer community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Features](#suggesting-features)
    - [Code Contributions](#code-contributions)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/alexnguyen03/dotnet-project-toolkit/issues) to avoid duplicates.

When creating a bug report, include:

- **Clear title** - Describe the issue concisely
- **Steps to reproduce** - Detailed steps to reproduce the behavior
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Screenshots** - If applicable
- **Environment**:
    - VS Code version
    - Extension version
    - Operating System
    - .NET SDK version

**Example:**

```markdown
**Title:** Deployment fails with "Project path not found" error

**Steps to Reproduce:**

1. Open workspace with .NET project
2. Click deploy on UAT profile
3. See error in output

**Expected:** Deployment should start
**Actual:** Error "Project path not found"

**Environment:**

- VS Code: 1.95.0
- Extension: 0.1.1
- OS: Windows 11
- .NET: 8.0.100
```

### Suggesting Features

We love feature suggestions! Before creating a feature request:

1. Check [existing feature requests](https://github.com/alexnguyen03/dotnet-project-toolkit/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)
2. Check the [roadmap](README.md#-roadmap) to see if it's already planned

When suggesting a feature, include:

- **Use case** - Why is this feature needed?
- **Proposed solution** - How should it work?
- **Alternatives** - What alternatives have you considered?
- **Additional context** - Screenshots, mockups, examples

### Code Contributions

We welcome code contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

---

## Development Setup

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **VS Code** 1.95.0 or higher
- **.NET SDK** 6.0 or higher (for testing)
- **Git**

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/dotnet-project-toolkit.git
cd dotnet-project-toolkit

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run compile

# 4. Open in VS Code
code .
```

### Running the Extension

1. Press `F5` in VS Code
2. A new "Extension Development Host" window opens
3. Test your changes in this window
4. Check the Debug Console for logs

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run watch-tests
```

---

## Coding Guidelines

### TypeScript Style

We use **Prettier** and **ESLint** to enforce code style:

```bash
# Check formatting
npm run format:check

# Auto-format code
npm run format

# Lint code
npm run lint
```

### Code Style Rules

- **Tabs for indentation** (4 spaces width)
- **Single quotes** for strings
- **Semicolons** required
- **Trailing commas** for ES5 compatibility
- **100 character line limit**

### Naming Conventions

- **Classes**: PascalCase (`DeploymentService`)
- **Interfaces**: PascalCase with `I` prefix (`ICommand`)
- **Functions/Methods**: camelCase (`deployProfile`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Private members**: camelCase with `_` prefix (`_logger`)

### File Organization

```typescript
// 1. Imports (grouped: vscode, third-party, local)
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { ProjectInfo } from '../models/ProjectModels';

// 2. Interfaces/Types
interface DeploymentOptions {
	timeout: number;
	verbose: boolean;
}

// 3. Constants
const DEFAULT_TIMEOUT = 300;

// 4. Class/Function implementation
export class DeploymentService {
	// ...
}
```

### Documentation

- **JSDoc comments** for public APIs
- **Inline comments** for complex logic
- **README updates** for new features

Example:

```typescript
/**
 * Deploys a project using the specified publish profile.
 * @param projectPath - Absolute path to the .csproj file
 * @param profileName - Name of the publish profile
 * @param password - Deployment password (optional)
 * @returns Promise that resolves when deployment completes
 * @throws Error if deployment fails
 */
async deployProject(
	projectPath: string,
	profileName: string,
	password?: string
): Promise<void> {
	// Implementation
}
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
git commit -m "feat(deployment): add rollback functionality"

# Bug fix
git commit -m "fix(profile): resolve path resolution issue"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactoring
git commit -m "refactor(services): extract credential logic to separate service"
```

### Commit Best Practices

- ✅ Use present tense ("add feature" not "added feature")
- ✅ Use imperative mood ("move cursor to..." not "moves cursor to...")
- ✅ Keep subject line under 72 characters
- ✅ Reference issues and PRs in the footer

---

## Pull Request Process

### Before Submitting

1. ✅ **Update your fork** with the latest main branch
2. ✅ **Run tests** - Ensure all tests pass
3. ✅ **Format code** - Run `npm run format`
4. ✅ **Lint code** - Run `npm run lint`
5. ✅ **Update docs** - Update README if needed
6. ✅ **Test manually** - Test your changes in the Extension Development Host

### PR Checklist

```markdown
- [ ] Code follows the project's coding guidelines
- [ ] All tests pass (`npm test`)
- [ ] Code is formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow conventional commits
- [ ] PR description clearly explains the changes
```

### PR Description Template

```markdown
## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues

Fixes #123
Related to #456

## Testing

How has this been tested?

- [ ] Manual testing in Extension Development Host
- [ ] Unit tests added/updated
- [ ] Tested on Windows/macOS/Linux

## Screenshots (if applicable)

Add screenshots to help explain your changes.

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
```

### Review Process

1. **Automated checks** - CI runs tests and linting
2. **Code review** - Maintainer reviews the code
3. **Feedback** - Address any requested changes
4. **Approval** - PR is approved and merged

---

## Project Structure

Understanding the project structure will help you navigate the codebase:

```
dotnet-project-toolkit/
├── .vscode/                  # VS Code configuration
├── media/                    # Webview assets (HTML, CSS, JS)
├── resources/                # Icons and static resources
├── src/
│   ├── commands/            # Command implementations
│   ├── services/            # Business logic services
│   ├── ui/                  # TreeView providers and UI
│   ├── models/              # Data models and interfaces
│   ├── parsers/             # XML and file parsers
│   ├── generators/          # File generators
│   ├── strategies/          # Strategy pattern implementations
│   ├── repositories/        # Data access layer
│   ├── utils/               # Utility functions
│   ├── test/                # Unit tests
│   └── extension.ts         # Main entry point
├── .editorconfig            # Editor configuration
├── .prettierrc              # Prettier configuration
├── eslint.config.mjs        # ESLint configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Extension manifest
└── README.md                # Documentation
```

### Key Files

- **`extension.ts`** - Extension activation and registration
- **`package.json`** - Extension manifest, commands, and configuration
- **`ServiceContainer.ts`** - Dependency injection container
- **`PublishTreeProvider.ts`** - Main TreeView for publish profiles
- **`DeploymentService.ts`** - Core deployment logic

---

## Development Tips

### Debugging

- Use `console.log()` or VS Code's debugger
- Check the **Debug Console** in the Extension Development Host
- Use **Output Channel** for user-facing logs

### Testing Changes

1. Make changes to the code
2. Press `F5` to launch Extension Development Host
3. Test in the new window
4. Check logs in Debug Console
5. Iterate

### Common Tasks

```bash
# Watch for changes (auto-compile)
npm run watch

# Build production bundle
npm run package

# Create VSIX package
npx vsce package
```

---

## Getting Help

- 💬 [GitHub Discussions](https://github.com/alexnguyen03/dotnet-project-toolkit/discussions) - Ask questions
- 🐛 [GitHub Issues](https://github.com/alexnguyen03/dotnet-project-toolkit/issues) - Report bugs
- 📧 Email: [your-email@example.com](mailto:your-email@example.com)

---

## Recognition

Contributors will be recognized in:

- **README.md** - Contributors section
- **CHANGELOG.md** - Release notes
- **GitHub** - Contributor graph

---

## License

By contributing, you agree that your contributions will be licensed under the **MIT License**.

---

**Thank you for contributing to .NET Project Toolkit! 🚀**

_Together, we're making .NET development in VS Code better for everyone._
