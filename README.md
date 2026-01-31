# MetaGroove

<div align="center">
  <img src="src/assets/icons/MetaGroove_Logo.png" alt="MetaGroove Logo" width="128" />
  <br>
  <h3>Advanced Music Filtering for YouTube, YouTube Music & SoundCloud</h3>
  <p>Filter by Year, Duration, Keywords & Discover Related Content without Algorithm Noise.</p>
</div>

<br>

---

## 🎵 What is MetaGroove?

**MetaGroove** is a browser extension that gives you control over your music streaming experience. Platforms like YouTube and SoundCloud are great, but they lack precise tools to find exactly what you want.

MetaGroove adds the missing layer: **advanced, parameterizable filters**.

### 💎 Why use it?

*   **🎧 DJs & Producers**: Find tracks from a specific era (e.g., "Deep House from 2010-2012") for your sets.
*   **📚 Researchers**: Analyze the evolution of a genre by filtering music releases over time.
*   **🎵 Power Users**: Filter out tracks that are too short (intros) or too long (mixes), or find specific remixes.
*   **🚀 Content Discovery**: Use our unique **Exploration Mode** on YouTube to force the "Related Videos" view, hiding the distraction of "For You" and "All" chips, keeping you focused on the rabbit hole you chose exploring.


---

## 📖 How to Install

1.  **Mozilla Firefox**: Install trough https://addons.mozilla.org/it/firefox/addon/metagroove/
2.  **Google Chrome**: Currently in approval phase


---

## 📖 How to Use

1.  **Open MetaGroove**: Go to YouTube, YouTube Music, or SoundCloud and click the extension icon.
2.  **Set Filters**:
    *   **Release Year**: Define a range (e.g., 2015 to 2020).
    *   **Duration**: Slider to exclude tracks too short or long.
    *   **Keywords**: Search for specific terms in titles/channels.
    *   **Exploration Mode**: (YouTube only) Check to lock suggestions to "Related" or "Unwatched".
3.  **Apply**: Click **Apply** and wait for the page to process the content.

> **⚡ Unique Feature:** MetaGroove automatically extracts metadata (even verifying release years from YouTube for YTM tracks) to ensure accurate filtering.

---

## ✨ Key Features

*   **Year Filter**: Filter content by release year range.
*   **Duration Filter**: Filter by track length (min/max).
*   **Blacklist**: Hide tracks containing specific unwanted words.
*   **Exploration Mode (YouTube)**: Automatically selects "Related Videos" on watch pages and "Not Watched" on search results, hiding algorithmic noise like "For You".
*   **Verified Year**: Displays the verified release year next to the relative date (e.g., "5 years ago (2018)") directly in the interface.
*   **Privacy Focused**: All processing happens locally in your browser. No data is collected.

---

## 💻 For Developers

MetaGroove is open-source! We welcome contributions to improve the tool.

### Database & Tech Stack
*   **JavaScript (ES6+)**
*   **Webpack** for bundling
*   **Manifest V3**

### Build Instructions

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/TX-Breaker/MetaGroove.git
    cd MetaGroove
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the extension**:
    - For **Firefox** (Production):
      ```bash
      npm run build:firefox
      ```
    - For **Chrome** (Production):
      ```bash
      npm run build:chrome
      ```

4.  **Load in Browser**:
    - **Firefox**: Go to `about:debugging` -> This Firefox -> Load Temporary Add-on -> Select `dist/firefox/manifest.json`.
    - **Chrome**: Go to `chrome://extensions` -> Developer Mode -> Load Unpacked -> Select `dist/chrome` folder.

### Contributing
Fork the repo, create a feature branch, and submit a Pull Request!

---

## 📜 License

Distributed under the **GNU General Public License v3.0** (GPLv3). See `LICENSE` for more information.

**Developed by TX-Breaker**
