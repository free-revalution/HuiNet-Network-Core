# Installation Guide

## Quick Install (Local Development)

Since HuiNet is not yet published to npm, you need to install from source:

### Method 1: Clone and Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build the project
npm run build

# Run HuiNet
npm start
```

### Method 2: Global Link (Run from anywhere)

```bash
# Clone and install
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core
npm install
npm run build

# Create global link
npm link
```

Now you can run `huinet` from anywhere:

```bash
huinet
```

## Verify Installation

```bash
huinet --help
```

## Start Using

```bash
# From project directory
npm start

# Or with custom name
npm start -- "My Computer"

# If globally linked
huinet
huinet "My Computer" --port 8001
```

## Update

```bash
cd HuiNet-Network-Core
git pull
npm install
npm run build
```

## Uninstall

```bash
# If globally linked
npm unlink -g @huinet/network

# Remove configuration
rm -rf ~/.huinet
```

## Requirements

- Node.js 16+ or higher
- npm or yarn package manager
- Git (for cloning)
- macOS, Linux, or Windows

## Platform-Specific Notes

### macOS / Linux

No additional setup required.

### Windows

You may need to add npm global binaries to your PATH:

```powershell
# Check npm global bin location
npm config get prefix

# Add to PATH (PowerShell)
$env:Path += ";C:\Users\YourName\AppData\Roaming\npm"
```

## Troubleshooting

**"command not found: huinet"**

1. Make sure you ran `npm link` in the project directory
2. Check npm global install location:
```bash
npm config get prefix
```

3. Add npm bin directory to your PATH:
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

**"Port already in use"**

Use a different port:
```bash
huinet --port 8001
```

**"Build failed"**

Make sure you have all dependencies:
```bash
npm install
npm run build
```

**"Module not found"**

Rebuild the project:
```bash
npm run build
```

---

**Future Release**

When HuiNet is published to npm, installation will be as simple as:
```bash
npm install -g @huinet/network
huinet
```

**Need help?** [Open an issue](https://github.com/free-revalution/HuiNet-Network-Core/issues)
