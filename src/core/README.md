# Core Module

This directory contains the core HuiNet node implementation classes.

## Purpose

The core module provides the fundamental building blocks for HuiNet functionality:

- **HuiNetNode**: Main node class for P2P networking
- Core networking protocols
- Node lifecycle management

## Structure

This is a new organizational structure. The core classes are currently being reorganized from the main src directory for better separation of concerns.

## Migration Status

This is part of an ongoing reorganization. The main `HuiNet` class is currently in `../HuiNet.ts` and will be gradually migrated to this structure.

For now, `HuiNetNode.ts` serves as a compatibility layer that re-exports the existing HuiNet class.

## Usage

```typescript
import { HuiNetNode } from './core/HuiNetNode';

// Create a new node
const node = new HuiNetNode({
  listenPort: 8000,
  enableMDNS: true
});

await node.start();
```

## Next Steps

- [ ] Migrate core node classes to this directory
- [ ] Separate node implementation from CLI concerns
- [ ] Update imports across the codebase
