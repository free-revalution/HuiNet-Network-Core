/**
 * HuiNetNode - Core Node Implementation
 *
 * This module re-exports the existing HuiNet class to maintain backward compatibility
 * while establishing the new core module structure.
 *
 * As part of the directory reorganization, this serves as a compatibility layer.
 * The full migration to separate core SDK from CLI will be ongoing.
 */

// Re-export the existing HuiNet class and config
export { HuiNet, HuiNetConfig } from '../HuiNet';

// Re-export HuiNetNode as an alias for HuiNet for clearer naming
export { HuiNet as HuiNetNode } from '../HuiNet';
