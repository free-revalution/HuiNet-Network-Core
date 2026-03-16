import { generateKeyPair } from '../keypair';
import { signMessage, verifySignature } from '../signature';

describe('Signature', () => {
  let keyPair: ReturnType<typeof generateKeyPair>;

  beforeEach(() => {
    keyPair = generateKeyPair();
  });

  describe('signMessage', () => {
    it('should sign a message with Ed25519', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBe(64); // Ed25519 signature size
    });

    it('should produce different signatures for different messages', () => {
      const message1 = Buffer.from('Message 1');
      const message2 = Buffer.from('Message 2');

      const sig1 = signMessage(message1, keyPair.privateKey);
      const sig2 = signMessage(message2, keyPair.privateKey);

      expect(sig1).not.toEqual(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      const valid = verifySignature(message, signature, keyPair.publicKey);
      expect(valid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      // Tamper with the message
      const tamperedMessage = Buffer.from('Hello, World!');

      const valid = verifySignature(tamperedMessage, signature, keyPair.publicKey);
      expect(valid).toBe(false);
    });

    it('should reject signature with wrong public key', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      const wrongKeyPair = generateKeyPair();
      const valid = verifySignature(message, signature, wrongKeyPair.publicKey);
      expect(valid).toBe(false);
    });
  });
});
