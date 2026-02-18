# Lumen

**Illuminate your memory.**

Lumen is a privacy-focused, AI-powered desktop utility that helps you capture, recall, and understand information from your screen. Built on Electron and powered locally by **Ollama**, Lumen acts as a "second brain" that lives in your menu bar, allowing you to capture screenshots, extract text (OCR), and perform semantic searches on your history without sending data to the cloud.

## ✨ Features

* **Local AI Intelligence**: Completely offline AI processing using [Ollama](https://ollama.com/).
* **Screen Context Capture**: Select any region of your screen to capture text and images instantly.
* **Optical Character Recognition (OCR)**: Extracts text from images using **Tesseract.js** or multimodal Ollama models.
* **Semantic Search**: Search your history using natural language (e.g., *"Where is that code I was debugging yesterday?"*) rather than exact keyword matches.
* **AI Actions**: Instantly perform tasks on captured text:
* Summarize
* Explain
* Translate
* Code Review / Debug / Refactor


* **Clipboard Monitoring**: (Optional) Automatically save and index text copied to your clipboard.
* **Thinking Model Support**: Compatible with reasoning models (like DeepSeek-R1) via Ollama.
* **Cross-Platform**: Runs on macOS, Windows, and Linux.

## 🛠 Prerequisites

Lumen relies on **Ollama** to function. You must have it installed and running.

1. **Install Ollama**: Download from [ollama.com](https://ollama.com).
2. **Start Ollama**: Ensure the server is running (`ollama serve`).
3. **Pull Embedding Model**: Lumen requires an embedding model for search. It attempts to pull this automatically, but you can do it manually:
```bash
ollama pull nomic-embed-text
```



## 📦 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/systemsoftware/lumen.git
cd lumen
```


2. **Install dependencies**:
```bash
npm install
```


3. **Run the application**:
```bash
npm start
```



## 🚀 Usage

### The Tray App

Lumen runs as a **Menu Bar / System Tray** application. Click the icon to open the search interface or access settings.

### Capturing Content

* **Shortcut**: Press `Cmd + Shift + A` (or `Ctrl + Shift + A` on Windows/Linux) to trigger the overlay.
* **Select**: Drag to select an area of your screen.
* **Analyze**: Lumen will extract the text, save the screenshot, and allow you to chat with the AI about the content immediately.

### Searching Memory

Open the tray window and type a natural language query. Lumen uses vector embeddings to find the most relevant screenshots and text from your past activities.

### Context Menu

Right-click the tray icon to access:

* **Settings**: Configure AI models and shortcuts.
* **Memory**: View a timeline of all captured screenshots and clipboard history.
* **Add Existing Screenshot**: Import images manually.

## ⚙️ Configuration

You can configure Lumen via the Settings window:

* **AI Model**: Select the chat model to use (e.g., `llama3`, `mistral`, `deepseek-r1`).
* **Vision Model**: Choose between built-in `Tesseract` or an Ollama vision model (e.g., `llava`) for better OCR.
* **Shortcuts**: Customize the global capture hotkey.
* **History Limit**: Set a limit on how many items to keep to save space.
* **Clipboard Monitoring**: Enable/Disable auto-saving of copied text.

## 🏗 Tech Stack

* **Framework**: [Electron](https://www.electronjs.org/)
* **AI Engine**: [Ollama](https://ollama.com/) (via `ollama-js`)
* **OCR**: [Tesseract.js](https://www.google.com/search?q=https://github.com/naptha/tesseract.js)
* **Database**: [Dubnium](https://www.google.com/search?q=https://www.npmjs.com/package/dubnium) (Local Key-Value Store)
* **Vector Embeddings**: `nomic-embed-text`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.