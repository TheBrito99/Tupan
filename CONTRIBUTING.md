# Contributing to Tupan

Thank you for your interest in contributing to Tupan!

## How to Contribute

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** your changes
4. **Test** your changes: `pnpm test`
5. **Commit** your changes: `git commit -m "Description"`
6. **Push** to your fork: `git push origin feature/your-feature`
7. **Open** a Pull Request

## Development Setup

```bash
git clone https://github.com/yourusername/tupan.git
cd tupan
pnpm install
pnpm dev
```

## Code Style

- **Rust**: Run `cargo fmt` and `cargo clippy`
- **TypeScript**: ESLint is configured, run `pnpm lint`
- **Tests**: All new features must have tests

## Commit Message Guidelines

- Use clear, descriptive messages
- Start with a verb: "Add", "Fix", "Update", "Refactor"
- Reference issues: "Fix #123"
- Example: `Fix type inference in BlockDiagramEditor (closes #42)`

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation if needed
- Link to related issues

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn

Thank you for contributing!
