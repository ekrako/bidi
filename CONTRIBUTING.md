# Contributing to BiDi

Thanks for your interest in BiDi! We welcome contributions to make the RTL experience on the web better for everyone.

---

## How to Contribute

### 1. Reporting Bugs
-   Check if the bug has already been reported in the Issues section.
-   If not, open a new issue with a clear title and description.
-   Include steps to reproduce and the website URL where the issue occurred.

### 2. Requesting Features
-   Open a new issue and label it as a feature request.
-   Describe the problem you're trying to solve and how the feature would help.

### 3. Pull Requests
-   Fork the repository.
-   Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name`.
-   Write clear, modular code following the project's existing style.
-   Add tests for any new logic or bug fixes.
-   Ensure all tests pass by running `bun test`.
-   Submit a pull request with a detailed description of your changes.

---

## Development Workflow

BiDi uses [Bun](https://bun.com) as its package manager and build tool.

### Setup
```bash
bun install
```

### Build
To build the extension for testing:
```bash
bun run build
```

### Test
Run the test suite to ensure everything is working correctly:
```bash
bun test
```

---

## Coding Guidelines

-   **TypeScript:** Use TypeScript for all logic. Ensure types are explicit where possible.
-   **Bun APIs:** Prefer Bun's built-in APIs over Node.js equivalents where appropriate (e.g., `Bun.file` vs `fs`).
-   **Modularity:** Keep logic separated into appropriate modules (e.g., storage, RTL detection, content script).
-   **Chrome Extension APIs:** Use modern Manifest V3 APIs.

---

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Questions?

If you have any questions, feel free to open an issue or reach out to the project maintainers.
