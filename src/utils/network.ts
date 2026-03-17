/**
 * Network Utilities
 *
 * Provides helper functions for network operations like IP address manipulation
 * and subnet detection.
 */

import * as os from 'os';

/**
 * Network interface information
 */
export interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}

/**
 * Get all network interfaces on the local machine
 */
export function getNetworkInterfaces(): NetworkInterface[] {
  const interfaces = os.networkInterfaces();
  const result: NetworkInterface[] = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;

    for (const net of nets) {
      result.push({
        name,
        address: net.address,
        netmask: net.netmask,
        family: net.family === 'IPv4' ? 'IPv4' : 'IPv6',
        internal: net.internal,
      });
    }
  }

  return result;
}

/**
 * Get local IP addresses with optional filtering
 */
export interface GetLocalIPOptions {
  ipv4Only?: boolean;
  ipv6Only?: boolean;
  excludeInternal?: boolean;
  interfaceName?: string;
}

export function getLocalIPs(options: GetLocalIPOptions = {}): string[] {
  const {
    ipv4Only = false,
    ipv6Only = false,
    excludeInternal = true,
    interfaceName,
  } = options;

  const interfaces = getNetworkInterfaces();
  const ips: string[] = [];

  for (const iface of interfaces) {
    if (ipv4Only && iface.family !== 'IPv4') continue;
    if (ipv6Only && iface.family !== 'IPv6') continue;
    if (excludeInternal && iface.internal) continue;
    if (interfaceName && !iface.name.includes(interfaceName)) continue;

    ips.push(iface.address);
  }

  return ips;
}

/**
 * Get the primary local IP address (first non-internal IPv4 address)
 */
export function getPrimaryLocalIP(): string | undefined {
  const ips = getLocalIPs({ ipv4Only: true, excludeInternal: true });
  return ips[0];
}

/**
 * Convert an IPv4 address to a number
 */
export function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }

  for (const part of parts) {
    if (isNaN(part) || part < 0 || part > 255) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }
  }

  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Convert a number to an IPv4 address
 */
export function numberToIPv4(num: number): string {
  return [
    (num >>> 24) & 0xFF,
    (num >>> 16) & 0xFF,
    (num >>> 8) & 0xFF,
    num & 0xFF,
  ].join('.');
}

/**
 * Check if two IPv4 addresses are in the same subnet
 */
export function isSameSubnet(ip1: string, ip2: string, maskBits: number = 24): boolean {
  if (maskBits < 0 || maskBits > 32) {
    throw new Error(`Invalid subnet mask bits: ${maskBits}`);
  }

  try {
    const num1 = ipv4ToNumber(ip1);
    const num2 = ipv4ToNumber(ip2);
    const maskNum = (0xFFFFFFFF << (32 - maskBits)) >>> 0;

    return (num1 & maskNum) === (num2 & maskNum);
  } catch {
    return false;
  }
}

/**
 * Check if an IP address is in a private network range
 */
export function isPrivateIP(ip: string): boolean {
  try {
    const num = ipv4ToNumber(ip);

    // 10.0.0.0/8
    if ((num >>> 24) === 10) return true;

    // 172.16.0.0/12 - check first octet is 172 and second octet is 16-31
    const firstOctet = num >>> 24;
    const secondOctet = (num >>> 16) & 0xFF;
    if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;

    // 192.168.0.0/16
    if (firstOctet === 192 && secondOctet === 168) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if an IP address is a loopback address
 */
export function isLoopbackIP(ip: string): boolean {
  try {
    const num = ipv4ToNumber(ip);
    return (num & 0xFF000000) === 0x7F000000;
  } catch {
    return false;
  }
}

/**
 * Get network information for the local machine
 */
export interface NetworkInfo {
  hostname: string;
  interfaces: Array<{
    name: string;
    addresses: string[];
    internal: boolean;
  }>;
  primaryIP?: string;
  isPrivate: boolean;
}

export function getNetworkInfo(): NetworkInfo {
  const interfaces = os.networkInterfaces();
  const interfaceList: Array<{
    name: string;
    addresses: string[];
    internal: boolean;
  }> = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;

    const addresses = nets
      .filter(net => net.family === 'IPv4')
      .map(net => net.address);

    if (addresses.length > 0) {
      interfaceList.push({
        name,
        addresses,
        internal: nets[0].internal,
      });
    }
  }

  const primaryIP = getPrimaryLocalIP();

  return {
    hostname: os.hostname(),
    interfaces: interfaceList,
    primaryIP,
    isPrivate: primaryIP ? isPrivateIP(primaryIP) : false,
  };
}
