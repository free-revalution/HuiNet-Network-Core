# Installation Guide

## Quick Install (Global)

```bash
npm install -g @huinet/network
```

## Verify Installation

```bash
huinet --version
huinet --help
```

## Start Using

```bash
huinet
```

## Update

```bash
npm update -g @huinet/network
```

## Uninstall

```bash
npm uninstall -g @huinet/network
rm -rf ~/.huinet
```

## Requirements

- Node.js 16+ or higher
- npm or yarn package manager
- macOS, Linux, or Windows

## Platform-Specific Notes

### macOS / Linux

No additional setup required. Just install and run.

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

1. Check npm global install location:
```bash
npm config get prefix
```

2. Add npm bin directory to your PATH:
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

3. Or reinstall with correct permissions:
```bash
sudo npm install -g @huinet/network
```

**"Port already in use"**

Use a different port:
```bash
huinet --port 8001
```

**"Firewall blocking connection"**

Allow port 8000 (or your chosen port) in your firewall settings.

---

**Need help?** [Open an issue](https://github.com/free-revalution/HuiNet-Network-Core/issues)
