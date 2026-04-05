# BiDi

**BiDi** is a smart Chrome extension designed to solve text alignment issues for Right-to-Left (RTL) languages like Hebrew and Arabic on websites that default to Left-to-Right (LTR) alignment. It provides persistent, per-site configuration and an intelligent "Auto" mode that detects RTL content and adjusts the layout automatically.

---

## Features

-   **None:** Standard browser behavior for the site.
-   **RTL (Force):** Forces the entire page to use `direction: rtl`.
-   **Auto (Smart Detection, default for new sites):** Dynamically detects RTL characters (Hebrew, Arabic, etc.) and applies RTL alignment only to elements containing RTL text. Uses a `MutationObserver` to handle dynamically loaded content in modern web apps (e.g., Claude, ChatGPT).
-   **Persistence:** Your settings are saved per-site and synced across all your Chrome instances using `chrome.storage.sync`.
-   **Clean UI:** Simple, non-intrusive popup for quick state toggling.

---

## Installation (Developer Mode)

Since BiDi is currently in development, you can load it as an "unpacked extension" in Chrome:

1.  Clone the repository:
    ```bash
    git clone https://github.com/ekrako/bidi.git
    cd bidi
    ```
2.  Install dependencies:
    ```bash
    bun install
    ```
3.  Build the extension:
    ```bash
    bun run build
    ```
4.  Open Chrome and navigate to `chrome://extensions/`.
5.  Enable **Developer mode** (top right toggle).
6.  Click **Load unpacked** and select the `dist/` directory in the BiDi project folder.

---

## Development

BiDi is built using [Bun](https://bun.com) for fast builds and testing.

### Build
To bundle the extension and prepare the `dist/` folder:
```bash
bun run build
```

### Test
To run the test suite:
```bash
bun test
```

### Project Structure
- `src/content.ts`: Core logic for applying RTL/LTR direction.
- `src/popup.ts`: Logic for the extension's popup UI.
- `src/storage.ts`: Persistence layer using `chrome.storage`.
- `src/rtl.ts`: Utility for RTL text detection.
- `manifest.json`: Extension metadata and permissions.

### Documentation
- [Code explanation and architecture notes](documentations/code-explained.md)

### Release Notes
- Stable release CI submits non-prerelease builds to the Chrome Web Store automatically.
- If upload succeeds but the publish API call fails, the package can remain uploaded but unpublished. In that case, check the Chrome Web Store Dashboard, review the latest draft submission, and resubmit or publish it manually after fixing the reported issue.

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

This project is licensed under the [MIT License](LICENSE).
