<div align="center">

<img src="https://github.com/user-attachments/assets/bbdaeb1c-b7f2-4a4b-a11a-34db4de0ba12" alt="autoglm-gui" width="150">

# AutoGLM-GUI

Modern Web GUI for AutoGLM Phone Agent - AI-Powered Android Device Automation Made Simple

**🎉 Android 11+ devices now support fully wireless pairing via QR code, no cable required! 🎉**

![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)
[![PyPI](https://img.shields.io/pypi/v/autoglm-gui)](https://pypi.org/project/autoglm-gui/)
<br/>
  <a href="https://qm.qq.com/q/J5eAs9tn0W" target="__blank">
    <strong>Join our Discussion Group</strong>
  </a>

[中文文档](README.md)

</div>

## ✨ Features

- **Fully Wireless Pairing** - 🆕 Android 11+ QR code pairing, no cable needed
- **Multi-Device Control** - Manage and control multiple Android devices simultaneously with isolated states
- **Conversational Task Management** - Control Android devices through chat interface
- **Workflow System** - 🆕 Predefine common tasks for one-click execution, with full CRUD support
- **Real-time Screen Preview** - Low-latency scrcpy video streaming to monitor device operations
- **Direct Device Control** - Click and swipe directly on live video with precise coordinate mapping and visual feedback
- **Zero-Configuration Deployment** - Works with any OpenAI-compatible LLM API
- **Deep ADB Integration** - Direct device control via Android Debug Bridge (USB & WiFi support)
- **Modular Interface** - Clean sidebar + device panel design with clear separation of concerns

## 📥 Quick Download

**One-Click Desktop Version (No Environment Setup Required):**

<div align="center">

| Platform | Download Link | Notes |
|---------|---------|------|
| 🪟 **Windows** (x64) | [📦 Download Portable EXE](https://github.com/suyiiyii/AutoGLM-GUI/releases/download/v1.1.0/AutoGLM.GUI.1.1.0.exe) | For Windows 10/11, no installation needed |
| 🍎 **macOS** (Apple Silicon) | [📦 Download DMG](https://github.com/suyiiyii/AutoGLM-GUI/releases/download/v1.1.0/AutoGLM.GUI-1.1.0-arm64.dmg) | For M-series Macs |
| 🐧 **Linux** (x64) | [📦 Download AppImage](https://github.com/suyiiyii/AutoGLM-GUI/releases/download/v1.1.0/AutoGLM.GUI-1.1.0.AppImage) \| [deb](https://github.com/suyiiyii/AutoGLM-GUI/releases/download/v1.1.0/autoglm-gui_1.1.0_amd64.deb) \| [tar.gz](https://github.com/suyiiyii/AutoGLM-GUI/releases/download/v1.1.0/autoglm-gui-1.1.0.tar.gz) | Universal format for major distributions |

</div>

**Usage Instructions:**
- **Windows**: Download and double-click the `.exe` file to run, no installation required
- **macOS**: Download and double-click the `.dmg` file, drag to Applications folder. First launch may require allowing in System Settings → Privacy & Security
- **Linux**:
  - **AppImage** (Recommended): Download, add execute permission `chmod +x AutoGLM*.AppImage`, then run directly
  - **deb**: For Debian/Ubuntu systems, install with `sudo dpkg -i autoglm*.deb`
  - **tar.gz**: Portable version, extract and run `./AutoGLM\ GUI/autoglm-gui`

> 💡 **Tip**: Desktop version includes all dependencies (Python, ADB, etc.), no manual environment setup needed. You'll need to configure model service API on first launch.

---

**Or use Python package (requires Python environment):**

```bash
# Install via pip (recommended)
pip install autoglm-gui

# Or run without installation using uvx (requires uv installed)
uvx autoglm-gui
```

## 📸 Screenshots

### Task Started
![Task Started](https://github.com/user-attachments/assets/b8cb6fbc-ca5b-452c-bcf4-7d5863d4577a)

### Task Completed
![Task Completed](https://github.com/user-attachments/assets/b32f2e46-5340-42f5-a0db-0033729e1605)

### Multi-Device Control
![Multi-Device Control](https://github.com/user-attachments/assets/f826736f-c41f-4d64-bf54-3ca65c69068d)

## 🚀 Quick Start

## 🎯 Model Service Configuration

AutoGLM-GUI requires an OpenAI-compatible model service. You can:

- Use officially hosted third-party services:
  - Zhipu BigModel: `--base-url https://open.bigmodel.cn/api/paas/v4`, `--model autoglm-phone`, `--apikey <your API Key>`
  - ModelScope: `--base-url https://api-inference.modelscope.cn/v1`, `--model ZhipuAI/AutoGLM-Phone-9B`, `--apikey <your API Key>`
- Or self-host: Refer to upstream project's [deployment guide](https://github.com/zai-org/Open-AutoGLM/blob/main/README.md) to deploy `zai-org/AutoGLM-Phone-9B` with vLLM/SGLang, then point `--base-url` to your service.

Examples:

```bash
# Using Zhipu BigModel
pip install autoglm-gui
autoglm-gui \
  --base-url https://open.bigmodel.cn/api/paas/v4 \
  --model autoglm-phone \
  --apikey sk-xxxxx

# Using ModelScope
pip install autoglm-gui
autoglm-gui \
  --base-url https://api-inference.modelscope.cn/v1 \
  --model ZhipuAI/AutoGLM-Phone-9B \
  --apikey sk-xxxxx

# Using your self-hosted vLLM/SGLang service
pip install autoglm-gui
autoglm-gui --base-url http://localhost:8000/v1 --model autoglm-phone-9b
```

### Prerequisites

- Python 3.10+
- Android device (Android 11+ supports fully wireless pairing, no cable needed)
- ADB installed and added to system PATH (desktop version includes ADB)
- An OpenAI-compatible API endpoint

**About Device Connection**:
- **Android 11+**: QR code pairing supported, no cable needed for connection and control
- **Android 10 and below**: Initial USB connection required to enable wireless debugging, then cable can be removed

### Quick Run (Recommended)

**No manual environment setup required, just install and run:**

```bash
# Install via pip and start
pip install autoglm-gui
autoglm-gui --base-url http://localhost:8080/v1
```

Or use uvx for installation-free startup with latest version (requires uv installed, [installation guide](https://docs.astral.sh/uv/getting-started/installation/)):

```bash
uvx autoglm-gui --base-url http://localhost:8080/v1
```

### Traditional Installation

```bash
# Install from source
git clone https://github.com/your-repo/AutoGLM-GUI.git
cd AutoGLM-GUI
uv sync

# Build frontend (required)
uv run python scripts/build.py

# Start service
uv run autoglm-gui --base-url http://localhost:8080/v1
```

After startup, open http://localhost:8000 in your browser to start using!

## 🔄 Upgrade Guide

### Check Current Version

```bash
# View installed version
pip show autoglm-gui

# Or use command-line argument
autoglm-gui --version
```

### Upgrade to Latest Version

**Using pip:**

```bash
# Upgrade to latest version
pip install --upgrade autoglm-gui
```

## 📖 Usage Guide

### Multi-Device Management

AutoGLM-GUI supports controlling multiple Android devices simultaneously:

1. **Device List** - Left sidebar automatically shows all connected ADB devices
2. **Device Selection** - Click device card to switch to its control panel
3. **Status Indicators** - Clearly shows each device's online and initialization status
4. **State Isolation** - Each device has independent chat history, config, and video stream

**Device Status Indicators**:
- 🟢 Green dot: Device online
- ⚪ Gray dot: Device offline
- ✓ Mark: Device initialized

#### 📱 QR Code Wireless Pairing (Android 11+ Recommended)

**No cable needed**, phone and computer just need to be on the same WiFi network:

1. **Phone Setup**:
   - Open Settings → Developer Options → Enable "Wireless Debugging"
   - Keep phone and computer on the same WiFi network

2. **Computer Operations**:
   - Click ➕ "Add Wireless Device" button in bottom-left corner
   - Switch to "Pair Device" tab
   - **QR code auto-generated**, ready for scanning

3. **Phone Scanning**:
   - In "Wireless Debugging" page, tap "Pair device with QR code"
   - Scan the QR code displayed on computer
   - After successful pairing, device automatically appears in device list

**Features**:
- ✅ No cable needed
- ✅ One-click QR code pairing
- ✅ Automatic device discovery and connection
- ✅ Works with Android 11 and above

### AI Automation Mode

1. **Connect Device** - Use any method above (QR code pairing recommended for Android 11+)
2. **Select Device** - Choose device to control in left sidebar
3. **Initialize** - Click "Initialize Device" button to configure Agent
4. **Chat** - Describe what you want to do (e.g., "Order a Boba Milk Tea from Meituan")
5. **Observe** - Agent executes operations step-by-step, showing thinking process and actions in real-time

### Manual Control Mode

Besides AI automation, you can also directly control the phone on live screen:

1. **Live Screen** - Right side of device panel shows real-time video stream (scrcpy-based)
2. **Click Operations** - Click anywhere on the screen, operations sent to phone immediately
3. **Swipe Gestures** - Hold and drag mouse to perform swipe operations (scroll wheel supported)
4. **Visual Feedback** - Each operation shows ripple animation and success/failure notification
5. **Precise Mapping** - Automatically handles screen scaling and coordinate transformation for accurate positioning
6. **Display Modes** - Support switching between auto, video stream, and screenshot modes

### Workflow Management

Save common tasks as Workflows for one-click execution:

#### Creating and Managing Workflows

1. **Enter Management Page** - Click Workflows icon (📋) in left sidebar
2. **Create New Workflow** - Click "New Workflow" button in top-right corner
3. **Fill Information**:
   - **Name**: Give the Workflow a short, memorable name (e.g., "Order Boba Tea")
   - **Task Content**: Detailed description of task to execute (e.g., "Order a Boba Milk Tea from Meituan, no ice, add pearls")
4. **Save** - Click save button

**Management Operations**:
- **Edit** - Click "Edit" button on Workflow card to modify content
- **Delete** - Click "Delete" button to remove unwanted Workflows
- **Preview** - Workflow card shows preview of first few lines of task content

#### Quick Workflow Execution

Execute saved Workflows in Chat interface:

1. **Select Device** - Ensure target device is selected and initialized
2. **Open Workflow Selector** - Click Workflow button (📋 icon) next to input box
3. **Select Task** - Click the Workflow you want to execute from the list
4. **Auto-fill** - Task content automatically fills into input box
5. **Send and Execute** - Click send button to start execution

**Use Case Examples**:
- 📱 **Daily Tasks**: Order food, call taxi, check delivery
- 🎮 **Gaming Operations**: Daily check-in, claim rewards
- 📧 **Message Sending**: Bulk messages with fixed content
- 🔄 **Repetitive Operations**: Periodic maintenance tasks

## 🛠️ Development Guide

### Quick Development

```bash
# Backend development (auto-reload)
uv run autoglm-gui --base-url http://localhost:8080/v1 --reload

# Frontend dev server (hot reload)
cd frontend && pnpm dev
```

### Build and Package

```bash
# Build frontend only
uv run python scripts/build.py

# Build complete package
uv run python scripts/build.py --pack
```

## 📝 License

Apache License 2.0

### License Notice

AutoGLM-GUI is licensed under Apache License 2.0. However, it bundles ADB Keyboard APK (`com.android.adbkeyboard`), which is licensed under GPL-2.0. The ADB Keyboard component is used as an independent tool and does not affect AutoGLM-GUI's Apache 2.0 license.

See: `AutoGLM_GUI/resources/apks/ADBKeyBoard.LICENSE.txt`

## 🙏 Acknowledgments

This project is built upon [Open-AutoGLM](https://github.com/zai-org/Open-AutoGLM). Thanks to the zai-org team for their excellent work on AutoGLM.
