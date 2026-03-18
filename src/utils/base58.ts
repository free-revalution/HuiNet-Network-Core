// Simple Base58 implementation (Bitcoin alphabet)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(58);

export class Base58 {
  private static readonly ALPHABET = ALPHABET;
  private static readonly BASE = BASE;
  private static readonly MAP: Record<string, bigint> = {};
  private static readonly MAX_BUFFER_SIZE = 4096; // 4KB limit to prevent DoS

  static {
    for (let i = 0; i < ALPHABET.length; i++) {
      this.MAP[ALPHABET[i]] = BigInt(i);
    }
  }

  static encode(buffer: Buffer): string {
    // CRITICAL: Handle empty buffer to prevent crash
    if (buffer.length === 0) {
      return '';
    }

    // HIGH: Add size limit validation to prevent DoS
    if (buffer.length > this.MAX_BUFFER_SIZE) {
      throw new Error(`Buffer too large: ${buffer.length} > ${this.MAX_BUFFER_SIZE}`);
    }

    let num = BigInt('0x' + buffer.toString('hex'));
    let result = '';

    while (num > 0n) {
      const remainder = num % this.BASE;
      result = this.ALPHABET[Number(remainder)] + result;
      num = num / this.BASE;
    }

    // Handle leading zeros
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      result = '1' + result;
    }

    return result;
  }

  static decode(string: string): Buffer {
    // Handle empty string
    if (string.length === 0) {
      return Buffer.alloc(0);
    }

    let num = 0n;

    // Count leading zeros (represented as '1' in Base58)
    let leadingZeros = 0;
    for (let i = 0; i < string.length && string[i] === '1'; i++) {
      leadingZeros++;
    }

    for (const char of string) {
      if (!(char in this.MAP)) {
        throw new Error(`Invalid Base58 character: ${char}`);
      }
      num = num * this.BASE + this.MAP[char];
    }

    // If the string is all '1's (all zeros in original), return buffer of zeros
    if (num === 0n) {
      return Buffer.alloc(leadingZeros);
    }

    let hex = num.toString(16);

    // Ensure even length for Buffer.from
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }

    // Add leading zeros back
    const result = Buffer.alloc(leadingZeros);
    const valueBuffer = Buffer.from(hex, 'hex');
    return Buffer.concat([result, valueBuffer]);
  }
}
