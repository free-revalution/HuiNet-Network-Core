import { BaseMessage, MessageHeader } from '../types/message';

// Message format:
// [header_len:varint][header_json][body_len:varint][body][signature_len:varint][signature]

export function encodeMessage(message: BaseMessage): Buffer {
  const headerJson = JSON.stringify(message.header);
  const headerBuffer = Buffer.from(headerJson, 'utf-8');
  const body = message.body || Buffer.alloc(0);
  const signature = message.signature;

  // Encode lengths as varint
  const headerLen = encodeVarint(headerBuffer.length);
  const bodyLen = encodeVarint(body.length);
  const sigLen = encodeVarint(signature.length);

  return Buffer.concat([headerLen, headerBuffer, bodyLen, body, sigLen, signature]);
}

export function decodeMessage(buffer: Buffer): BaseMessage {
  let offset = 0;

  // Read header length
  const headerLen = decodeVarint(buffer, offset);
  offset += headerLen.bytesRead;

  // Read header
  const headerBuffer = buffer.subarray(offset, offset + headerLen.value);
  offset += headerLen.value;
  const header: MessageHeader = JSON.parse(headerBuffer.toString('utf-8'));

  // Read body length
  const bodyLen = decodeVarint(buffer, offset);
  offset += bodyLen.bytesRead;

  // Read body
  const body = buffer.subarray(offset, offset + bodyLen.value);
  offset += bodyLen.value;

  // Read signature length
  const sigLen = decodeVarint(buffer, offset);
  offset += sigLen.bytesRead;

  // Read signature
  const signature = buffer.subarray(offset, offset + sigLen.value);

  return { header, body, signature };
}

// Simple varint encoding (for small values)
function encodeVarint(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(5);
  let offset = 0;

  do {
    let byte = value & 0x7F;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    buffer[offset++] = byte;
  } while (value !== 0);

  return buffer.subarray(0, offset);
}

function decodeVarint(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset < buffer.length) {
    const byte = buffer[offset++];
    bytesRead++;
    value |= (byte & 0x7F) << shift;

    if ((byte & 0x80) === 0) break;
    shift += 7;

    if (shift >= 32) {
      throw new Error('Varint too long');
    }
  }

  return { value, bytesRead };
}
