# MetaGroove - Reviewers Guide

This project uses Webpack to bundle the extension source code.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Build Instructions

1.  **Install Dependencies**:
    Open a terminal in the project root directory and run:
    ```bash
    npm install
    ```

2.  **Build for Firefox**:
    Run the following command to build the extension specifically for Firefox (this applies Firefox-specific manifest adjustments):
    ```bash
    npm run build:firefox
    ```

3.  **Output**:
    The built extension files will be generated in the `dist/firefox/` directory.
    You can examine the contents of this directory or load it as a temporary add-on in Firefox for testing.

## Project Structure

- `src/`: Source code (JavaScript, HTML, CSS, Locales).
- `src/assets/manifest.json`: Base manifest file (transformed by Webpack).
- `webpack.config.js`: Webpack configuration logic.
- `package.json`: Dependencies and build scripts.