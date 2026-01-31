# MetaGroove

<div align="center">
  <img src="src/assets/icons/MetaGroove_Logo.png" alt="MetaGroove Logo" width="128" />
  <br>
  <h3>Advanced Music Filtering for YouTube, YouTube Music & SoundCloud</h3>
</div>

<br>

**MetaGroove** is a powerful browser extension designed for music enthusiasts, DJs, and researchers. It adds advanced filtering capabilities to major music streaming platforms that natively lack them.

## 🚀 Features

- **Advanced Filtering**: Filter content on YouTube, YouTube Music, and SoundCloud by:
  - **Release Year**: Set specific year ranges (e.g., 2010-2015).
  - **Duration**: Filter tracks by minimum and maximum length.
  - **Keywords**: Whitelist (search) or Blacklist specific terms in titles.
- **Exploration Mode (YouTube)**: A unique mode that automatically selects "Related Videos" and hides algorithmic feeds like "For You" or "All", allowing for pure, undistracted music discovery paths.
- **Verified Year**: Displays the detected release year next to the relative date (e.g., "5 years ago (2018)") to help you verify content age instantly.
- **Privacy Focused**: All filtering happens locally in your browser. No data is collected or transmitted.

## 🛠️ Installation

### From Source (Developer Mode)

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
    - For **Chrome**:
      ```bash
      npm run build:chrome
      ```
    - For **Firefox**:
      ```bash
      npm run build:firefox
      ```

4.  **Load in Browser**:
    - **Chrome**: Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/chrome` folder.
    - **Firefox**: Go to `about:debugging`, click **This Firefox**, then **Load Temporary Add-on**, and select `dist/firefox/manifest.json`.

## 🤝 Contributing

Contributions are welcome! If you have ideas for improvements or bug fixes, please open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📜 License

Distributed under the **GNU General Public License v3.0** (GPLv3). This ensures that the software remains free and open-source for everyone. See `LICENSE` for more information.

---

**Developed by TX-Breaker**