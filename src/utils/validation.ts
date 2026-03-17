/**
 * Configuration validation utilities
 */

/**
 * HuiNet configuration validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate port number
 */
export function validatePort(port: number, fieldName: string = 'port'): void {
  if (!Number.isInteger(port)) {
    throw new ValidationError(
      `${fieldName} must be an integer`,
      fieldName,
      port
    );
  }
  if (port < 0 || port > 65535) {
    throw new ValidationError(
      `${fieldName} must be between 0 and 65535`,
      fieldName,
      port
    );
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: number,
  fieldName: string
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(
      `${fieldName} must be a number`,
      fieldName,
      value
    );
  }
  if (value <= 0) {
    throw new ValidationError(
      `${fieldName} must be greater than 0`,
      fieldName,
      value
    );
  }
}

/**
 * Validate non-negative number
 */
export function validateNonNegativeNumber(
  value: number,
  fieldName: string
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(
      `${fieldName} must be a number`,
      fieldName,
      value
    );
  }
  if (value < 0) {
    throw new ValidationError(
      `${fieldName} must be non-negative`,
      fieldName,
      value
    );
  }
}

/**
 * Validate array of strings
 */
export function validateStringArray(
  value: any,
  fieldName: string
): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `${fieldName} must be an array`,
      fieldName,
      value
    );
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new ValidationError(
        `${fieldName} must contain only strings`,
        fieldName,
        value
      );
    }
  }
}

/**
 * Validate NodeID format
 */
export function validateNodeID(nodeID: string): void {
  if (typeof nodeID !== 'string') {
    throw new ValidationError(
      'NodeID must be a string',
      'nodeID',
      nodeID
    );
  }
  if (nodeID.length < 43 || nodeID.length > 44) {
    throw new ValidationError(
      'NodeID must be 43-44 characters (Base58 encoded)',
      'nodeID',
      nodeID
    );
  }
  // Base58 character set
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const char of nodeID) {
    if (!base58Chars.includes(char)) {
      throw new ValidationError(
        'NodeID contains invalid Base58 characters',
        'nodeID',
        nodeID
      );
    }
  }
}

/**
 * Validate HuiNet configuration
 */
export function validateHuiNetConfig(config: Record<string, any>): void {
  // Validate listenPort
  if (config.listenPort !== undefined) {
    validatePort(config.listenPort, 'listenPort');
  }

  // Validate listenHost
  if (config.listenHost !== undefined) {
    if (typeof config.listenHost !== 'string') {
      throw new ValidationError(
        'listenHost must be a string',
        'listenHost',
        config.listenHost
      );
    }
  }

  // Validate bootstrapNodes
  if (config.bootstrapNodes !== undefined) {
    validateStringArray(config.bootstrapNodes, 'bootstrapNodes');
  }

  // Validate maxCoreConnections
  if (config.maxCoreConnections !== undefined) {
    validatePositiveNumber(config.maxCoreConnections, 'maxCoreConnections');
  }

  // Validate maxActiveConnections
  if (config.maxActiveConnections !== undefined) {
    validatePositiveNumber(config.maxActiveConnections, 'maxActiveConnections');
  }

  // Connection count should be reasonable
  if (config.maxActiveConnections !== undefined && config.maxCoreConnections !== undefined) {
    if (config.maxActiveConnections < config.maxCoreConnections) {
      throw new ValidationError(
        'maxActiveConnections must be >= maxCoreConnections',
        'maxActiveConnections',
        config.maxActiveConnections
      );
    }
  }

  // Validate promoteToActiveThreshold
  if (config.promoteToActiveThreshold !== undefined) {
    validatePositiveNumber(config.promoteToActiveThreshold, 'promoteToActiveThreshold');
  }

  // Validate promoteToCoreThreshold
  if (config.promoteToCoreThreshold !== undefined) {
    validatePositiveNumber(config.promoteToCoreThreshold, 'promoteToCoreThreshold');
  }

  // Threshold relationship
  if (
    config.promoteToActiveThreshold !== undefined &&
    config.promoteToCoreThreshold !== undefined
  ) {
    if (config.promoteToCoreThreshold < config.promoteToActiveThreshold) {
      throw new ValidationError(
        'promoteToCoreThreshold must be >= promoteToActiveThreshold',
        'promoteToCoreThreshold',
        config.promoteToCoreThreshold
      );
    }
  }

  // Validate routingCleanupInterval
  if (config.routingCleanupInterval !== undefined) {
    validatePositiveNumber(config.routingCleanupInterval, 'routingCleanupInterval');
    // Should be reasonable (at least 1 minute)
    if (config.routingCleanupInterval < 60000) {
      throw new ValidationError(
        'routingCleanupInterval must be at least 60000ms (1 minute)',
        'routingCleanupInterval',
        config.routingCleanupInterval
      );
    }
  }

  // Validate maxNodeAge
  if (config.maxNodeAge !== undefined) {
    validatePositiveNumber(config.maxNodeAge, 'maxNodeAge');
    // Should be reasonable (at least 1 minute)
    if (config.maxNodeAge < 60000) {
      throw new ValidationError(
        'maxNodeAge must be at least 60000ms (1 minute)',
        'maxNodeAge',
        config.maxNodeAge
      );
    }
  }

  // Validate enableMDNS
  if (config.enableMDNS !== undefined && typeof config.enableMDNS !== 'boolean') {
    throw new ValidationError(
      'enableMDNS must be a boolean',
      'enableMDNS',
      config.enableMDNS
    );
  }
}

/**
 * Validate CLI ConfigData structure
 */
export function validateConfigData(data: any): void {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Config data must be an object');
  }

  // Validate name
  if (data.name !== undefined && typeof data.name !== 'string') {
    throw new ValidationError('name must be a string', 'name', data.name);
  }

  // Validate nodeID if present
  if (data.nodeID !== undefined) {
    validateNodeID(data.nodeID);
  }

  // Validate aliases
  if (data.aliases !== undefined) {
    if (typeof data.aliases !== 'object' || data.aliases === null || Array.isArray(data.aliases)) {
      throw new ValidationError(
        'aliases must be an object',
        'aliases',
        data.aliases
      );
    }
    // Validate each alias value (should be NodeID)
    for (const [alias, nodeID] of Object.entries(data.aliases)) {
      if (typeof nodeID !== 'string') {
        throw new ValidationError(
          `alias "${alias}" value must be a string`,
          `aliases.${alias}`,
          nodeID
        );
      }
    }
  }

  // Validate messageHistory if present
  if (data.messageHistory !== undefined) {
    if (!Array.isArray(data.messageHistory)) {
      throw new ValidationError(
        'messageHistory must be an array',
        'messageHistory',
        data.messageHistory
      );
    }
    for (let i = 0; i < data.messageHistory.length; i++) {
      const msg = data.messageHistory[i];
      if (typeof msg !== 'object' || msg === null) {
        throw new ValidationError(
          `messageHistory[${i}] must be an object`,
          `messageHistory[${i}]`,
          msg
        );
      }
      if (!['sent', 'received'].includes(msg.direction)) {
        throw new ValidationError(
          `messageHistory[${i}].direction must be "sent" or "received"`,
          `messageHistory[${i}].direction`,
          msg.direction
        );
      }
      if (typeof msg.target !== 'string') {
        throw new ValidationError(
          `messageHistory[${i}].target must be a string`,
          `messageHistory[${i}].target`,
          msg.target
        );
      }
      if (typeof msg.message !== 'string') {
        throw new ValidationError(
          `messageHistory[${i}].message must be a string`,
          `messageHistory[${i}].message`,
          msg.message
        );
      }
      if (typeof msg.timestamp !== 'number' || msg.timestamp < 0) {
        throw new ValidationError(
          `messageHistory[${i}].timestamp must be a positive number`,
          `messageHistory[${i}].timestamp`,
          msg.timestamp
        );
      }
    }
  }

  // Validate settings
  if (data.settings !== undefined) {
    if (typeof data.settings !== 'object' || data.settings === null) {
      throw new ValidationError(
        'settings must be an object',
        'settings',
        data.settings
      );
    }

    // Validate settings.mdns
    if (data.settings.mdns !== undefined && typeof data.settings.mdns !== 'boolean') {
      throw new ValidationError(
        'settings.mdns must be a boolean',
        'settings.mdns',
        data.settings.mdns
      );
    }

    // Validate settings.autoConnect
    if (data.settings.autoConnect !== undefined) {
      if (!Array.isArray(data.settings.autoConnect)) {
        throw new ValidationError(
          'settings.autoConnect must be an array',
          'settings.autoConnect',
          data.settings.autoConnect
        );
      }
      for (const item of data.settings.autoConnect) {
        if (typeof item !== 'string') {
          throw new ValidationError(
            'settings.autoConnect must contain only strings',
            'settings.autoConnect',
            data.settings.autoConnect
          );
        }
      }
    }
  }
}

/**
 * Sanitize config data by removing invalid fields and applying defaults
 */
export function sanitizeConfigData(data: any): any {
  const sanitized: any = {
    name: typeof data.name === 'string' ? data.name : 'MyAgent',
    aliases: {},
    settings: {
      mdns: true,
      autoConnect: []
    }
  };

  // Copy valid aliases
  if (data.aliases && typeof data.aliases === 'object') {
    for (const [key, value] of Object.entries(data.aliases)) {
      if (typeof value === 'string') {
        sanitized.aliases[key] = value;
      }
    }
  }

  // Copy valid settings
  if (data.settings && typeof data.settings === 'object') {
    if (typeof data.settings.mdns === 'boolean') {
      sanitized.settings.mdns = data.settings.mdns;
    }
    if (Array.isArray(data.settings.autoConnect)) {
      sanitized.settings.autoConnect = data.settings.autoConnect.filter(
        (item: any) => typeof item === 'string'
      );
    }
  }

  // Copy nodeID if valid
  if (data.nodeID && typeof data.nodeID === 'string') {
    try {
      validateNodeID(data.nodeID);
      sanitized.nodeID = data.nodeID;
    } catch {
      // Invalid nodeID, skip
    }
  }

  // Copy messageHistory if valid array
  if (Array.isArray(data.messageHistory)) {
    const validMessages = data.messageHistory.filter((msg: any) => {
      return (
        msg &&
        typeof msg === 'object' &&
        ['sent', 'received'].includes(msg.direction) &&
        typeof msg.target === 'string' &&
        typeof msg.message === 'string' &&
        typeof msg.timestamp === 'number' &&
        msg.timestamp >= 0
      );
    });
    if (validMessages.length > 0) {
      sanitized.messageHistory = validMessages;
    }
  }

  return sanitized;
}
