# AGENTS.md - .NET Project Toolkit Development Guide

This file contains development guidelines and commands for agentic coding agents working on the .NET Project Toolkit VS Code extension.

## Build Commands

### Development

```bash
npm run compile          # Compile TypeScript and check types
npm run watch            # Watch mode for development
npm run lint             # Run ESLint on source files
npm run format           # Format code with Prettier
npm run format:check      # Check formatting without changes
```

### Testing

```bash
npm run pretest          # Compile tests and lint
npm run test             # Run VS Code extension tests
npm run watch-tests      # Watch mode for tests
```

### Production

```bash
npm run package          # Build for production
npm run check-types      # Type checking only
```

### Single Test Execution

```bash
# Run specific test file
npx mocha --require ts-node/register --require source-map-support/register test/extension.test.ts

# Run specific test by name
npx mocha --grep "specific test name" test/extension.test.ts
```

## Code Style Guidelines

### Import Organization

- Group imports in this order: 1) VS Code API, 2) Node.js built-ins, 3) Local modules
- Use named imports for clarity: `import { ServiceContainer } from './container/ServiceContainer'`
- Avoid default imports for local modules when possible

### TypeScript Configuration

- Strict mode enabled (`"strict": true`)
- Target ES2022 with Node16 module resolution
- Use source maps for debugging
- No implicit returns or unused parameters (commented out in tsconfig)

### Naming Conventions

- **Classes**: PascalCase (e.g., `ServiceContainer`, `DeployProfileCommand`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `ICommand`, `IPasswordStorage`)
- **Methods/Functions**: camelCase (e.g., `execute()`, `buildPublishCommand()`)
- **Variables**: camelCase (e.g., `outputChannel`, `projectPath`)
- **Constants**: UPPER_SNAKE_CASE for exported constants
- **Files**: PascalCase for classes, kebab-case for utilities

### Error Handling

- Use try-catch blocks for async operations
- Log errors to output channel before throwing
- Provide user-friendly error messages via `vscode.window.showErrorMessage()`
- Return early on error conditions with proper cleanup

### VS Code Extension Patterns

- Use output channel for logging: `container.outputChannel.appendLine()`
- Show user notifications with appropriate icons: `vscode.window.showInformationMessage()`
- Register commands through CommandRegistry
- Use tree providers for UI views
- Follow VS Code extension activation/deactivation patterns

### Service Architecture

- Use dependency injection through ServiceContainer
- Implement interfaces for all services (`ICommand`, `IPasswordStorage`, etc.)
- Separate concerns: UI, services, repositories, parsers, generators
- Use configuration service for settings management
- Implement proper cleanup in deactivation

### Security Best Practices

- Never log passwords or sensitive data
- Use environment variables for password passing in deployment commands
- Implement timeout handling for long-running operations
- Validate URLs before opening external browsers
- Use secure password storage options (secret vs envvar)

### File Structure

```
src/
├── commands/          # Command implementations
├── container/         # Dependency injection
├── services/          # Business logic services
├── strategies/        # Password storage strategies
├── repositories/      # Data access layer
├── parsers/           # XML/HTML parsing
├── generators/        # Code generation
├── analyzers/         # Project analysis
├── detectors/         # Environment detection
├── models/            # TypeScript interfaces
├── ui/                # VS Code UI components
└── utils/             # Utility functions
```

### Testing Guidelines

- Use Mocha with TypeScript support
- Mock VS Code API where necessary
- Test both success and error paths
- Use descriptive test names
- Clean up test data after execution

### Performance Considerations

- Use async/await for I/O operations
- Implement proper cancellation for long-running tasks
- Use streaming for large file operations
- Cache expensive operations when appropriate
- Monitor memory usage in watch/debug services

### Documentation

- Add JSDoc comments for public APIs
- Include parameter types and return values
- Document error conditions and edge cases
- Use TODO/FIXME comments for temporary code

## Development Workflow

1. **Before coding**: Run `npm run pretest` to ensure clean state
2. **During development**: Use `npm run watch` for live compilation
3. **Before commit**: Run `npm run package` and `npm run lint`
4. **Testing**: Use `npm run test` for VS Code extension tests
5. **Formatting**: Run `npm run format` to ensure consistent style

## Common Patterns

### Command Implementation

```typescript
export class ExampleCommand implements ICommand {
	async execute(): Promise<void> {
		// Implementation
	}
}
```

### Service Implementation

```typescript
export class ExampleService implements IExampleService {
	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly configService: ConfigurationService
	) {}

	async doSomething(): Promise<void> {
		// Implementation
	}
}
```

### Error Handling Pattern

```typescript
try {
	await operation();
} catch (error: any) {
	service.outputChannel.appendLine(`Error: ${error.message}`);
	vscode.window.showErrorMessage('Operation failed: ' + error.message);
	throw error; // Re-throw if needed
}
```
