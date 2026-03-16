// Simple Base58 implementation (Bitcoin alphabet)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(58);

export class Base58 {
  private static readonly ALPHABET = ALPHABET;
  private static readonly BASE = BASE;
  private static readonly MAP: Record<string, bigint> = {};

  static {
    for (let i = 0; i < ALPHABET.length; i++) {
      this.MAP[ALPHABET[i]] = BigInt(i);
    }
  }

  static encode(buffer: Buffer): string {
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

    let hex = num.toString(16);

    // Add leading zeros back
    for (let i = 0; i < leadingZeros; i++) {
      hex = '00' + hex;
    }

    // Ensure even length for Buffer.from
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }

    return Buffer.from(hex, 'hex');
  }
}
