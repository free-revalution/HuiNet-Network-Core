/**
 * Network utilities tests
 */

import {
  getLocalIPs,
  getPrimaryLocalIP,
  ipv4ToNumber,
  numberToIPv4,
  isSameSubnet,
  isPrivateIP,
  isLoopbackIP,
  getNetworkInfo,
} from '../network';

describe('Network Utilities', () => {
  describe('ipv4ToNumber', () => {
    it('should convert valid IPv4 addresses to numbers', () => {
      expect(ipv4ToNumber('0.0.0.0')).toBe(0);
      // Note: JavaScript numbers are signed 32-bit, so 255.255.255.255 becomes -1
      expect(ipv4ToNumber('255.255.255.255')).toBe(-1);
      expect(ipv4ToNumber('192.168.1.1')).toBe((192 << 24) + (168 << 16) + (1 << 8) + 1);
      expect(ipv4ToNumber('10.0.0.1')).toBe((10 << 24) + 1);
    });

    it('should throw on invalid IPv4 addresses', () => {
      expect(() => ipv4ToNumber('invalid')).toThrow();
      expect(() => ipv4ToNumber('256.1.1.1')).toThrow();
      expect(() => ipv4ToNumber('1.1.1')).toThrow();
      expect(() => ipv4ToNumber('1.1.1.256')).toThrow();
      expect(() => ipv4ToNumber('-1.1.1.1')).toThrow();
    });
  });

  describe('numberToIPv4', () => {
    it('should convert numbers to IPv4 addresses', () => {
      expect(numberToIPv4(0)).toBe('0.0.0.0');
      expect(numberToIPv4(0xFFFFFFFF)).toBe('255.255.255.255');
      expect(numberToIPv4(0xC0A80101)).toBe('192.168.1.1');
      expect(numberToIPv4(0x0A000001)).toBe('10.0.0.1');
    });

    it('should be reversible with ipv4ToNumber', () => {
      const testIPs = ['1.2.3.4', '192.168.1.1', '10.0.0.1', '172.16.0.1'];
      for (const ip of testIPs) {
        expect(numberToIPv4(ipv4ToNumber(ip))).toBe(ip);
      }
    });
  });

  describe('isSameSubnet', () => {
    it('should detect IPs in the same subnet', () => {
      expect(isSameSubnet('192.168.1.1', '192.168.1.100', 24)).toBe(true);
      expect(isSameSubnet('192.168.1.1', '192.168.1.255', 24)).toBe(true);
      expect(isSameSubnet('10.0.0.1', '10.0.0.2', 24)).toBe(true);
    });

    it('should detect IPs in different subnets', () => {
      expect(isSameSubnet('192.168.1.1', '192.168.2.1', 24)).toBe(false);
      expect(isSameSubnet('192.168.1.1', '10.0.0.1', 24)).toBe(false);
      expect(isSameSubnet('10.0.1.1', '10.0.2.1', 24)).toBe(false);
    });

    it('should handle different subnet masks', () => {
      expect(isSameSubnet('192.168.1.1', '192.168.1.255', 24)).toBe(true);
      expect(isSameSubnet('192.168.1.1', '192.168.2.1', 16)).toBe(true);
      expect(isSameSubnet('10.0.1.1', '10.0.2.1', 16)).toBe(true);
      expect(isSameSubnet('192.168.1.1', '192.169.1.1', 8)).toBe(true);
      expect(isSameSubnet('192.168.1.1', '193.168.1.1', 8)).toBe(false);
    });

    it('should throw on invalid subnet mask', () => {
      expect(() => isSameSubnet('1.1.1.1', '2.2.2.2', -1)).toThrow();
      expect(() => isSameSubnet('1.1.1.1', '2.2.2.2', 33)).toThrow();
    });

    it('should handle invalid IPs gracefully', () => {
      expect(isSameSubnet('invalid', '192.168.1.1', 24)).toBe(false);
      expect(isSameSubnet('192.168.1.1', 'invalid', 24)).toBe(false);
    });
  });

  describe('isPrivateIP', () => {
    it('should identify private IP addresses', () => {
      // 10.0.0.0/8
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);

      // 172.16.0.0/12
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('172.15.0.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);

      // 192.168.0.0/16
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should identify public IP addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should handle invalid IPs', () => {
      expect(isPrivateIP('invalid')).toBe(false);
    });
  });

  describe('isLoopbackIP', () => {
    it('should identify loopback addresses', () => {
      expect(isLoopbackIP('127.0.0.1')).toBe(true);
      expect(isLoopbackIP('127.0.0.1')).toBe(true);
      expect(isLoopbackIP('127.255.255.255')).toBe(true);
    });

    it('should not identify non-loopback addresses', () => {
      expect(isLoopbackIP('192.168.1.1')).toBe(false);
      expect(isLoopbackIP('10.0.0.1')).toBe(false);
      expect(isLoopbackIP('8.8.8.8')).toBe(false);
    });

    it('should handle invalid IPs', () => {
      expect(isLoopbackIP('invalid')).toBe(false);
    });
  });

  describe('getLocalIPs', () => {
    it('should return local IP addresses', () => {
      const ips = getLocalIPs();
      expect(Array.isArray(ips)).toBe(true);
      expect(ips.length).toBeGreaterThan(0);
    });

    it('should filter IPv4 only', () => {
      const ips = getLocalIPs({ ipv4Only: true });
      for (const ip of ips) {
        expect(ip.includes('.')).toBe(true);
        expect(ip.includes(':')).toBe(false);
      }
    });

    it('should exclude internal addresses', () => {
      const ips = getLocalIPs({ excludeInternal: true });
      for (const ip of ips) {
        expect(isLoopbackIP(ip)).toBe(false);
      }
    });

    it('should include internal addresses when not excluded', () => {
      const allIPs = getLocalIPs({ excludeInternal: false });
      const noInternal = getLocalIPs({ excludeInternal: true });
      expect(allIPs.length).toBeGreaterThanOrEqual(noInternal.length);
    });
  });

  describe('getPrimaryLocalIP', () => {
    it('should return a non-loopback IPv4 address', () => {
      const ip = getPrimaryLocalIP();
      expect(ip).toBeDefined();
      expect(isLoopbackIP(ip!)).toBe(false);
    });

    it('should return a valid IPv4 address', () => {
      const ip = getPrimaryLocalIP();
      expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  describe('getNetworkInfo', () => {
    it('should return network information', () => {
      const info = getNetworkInfo();
      expect(info).toHaveProperty('hostname');
      expect(info).toHaveProperty('interfaces');
      expect(info).toHaveProperty('primaryIP');
      expect(Array.isArray(info.interfaces)).toBe(true);
    });

    it('should have at least one interface', () => {
      const info = getNetworkInfo();
      expect(info.interfaces.length).toBeGreaterThan(0);
    });

    it('should have a primary IP', () => {
      const info = getNetworkInfo();
      expect(info.primaryIP).toBeDefined();
      expect(typeof info.primaryIP).toBe('string');
    });
  });
});
