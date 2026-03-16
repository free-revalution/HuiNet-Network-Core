import { BaseMessage, MessageHeader } from '../types/message';

// Message format:
// [header_len:varint][header_json][body_len:varint][body][signature_len:varint][signature]

const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function encodeMessage(message: BaseMessage): Buffer {
  // CRITICAL: Input validation
  if (!message.header) {
    throw new Error('Message header is required');
  }
  if (!message.signature || !Buffer.isBuffer(message.signature)) {
    throw new Error('Message signature is required and must be a Buffer');
  }

  const headerJson = JSON.stringify(message.header);
  const headerBuffer = Buffer.from(headerJson, 'utf-8');
  const body = message.body || Buffer.alloc(0);
  const signature = message.signature;

  // Calculate total size
  const totalSize = headerBuffer.length + body.length + signature.length;
  if (totalSize > MAX_MESSAGE_SIZE) {
    throw new Error(`Message size exceeds maximum allowed size of ${MAX_MESSAGE_SIZE} bytes`);
  }

  // Encode lengths as varint
  const headerLen = encodeVarint(headerBuffer.length);
  const bodyLen = encodeVarint(body.length);
  const sigLen = encodeVarint(signature.length);

  return Buffer.concat([headerLen, headerBuffer, bodyLen, body, sigLen, signature]);
}

export function decodeMessage(buffer: Buffer): BaseMessage {
  // CRITICAL: Validate buffer size
  if (buffer.length > MAX_MESSAGE_SIZE) {
    throw new Error(`Buffer size exceeds maximum allowed size of ${MAX_MESSAGE_SIZE} bytes`);
  }

  let offset = 0;

  // Read header length
  const headerLen = decodeVarint(buffer, offset);
  offset += headerLen.bytesRead;

  // CRITICAL: Bounds checking before reading header
  if (offset + headerLen.value > buffer.length) {
    throw new Error('Buffer overflow: header length exceeds buffer size');
  }

  // Read header
  const headerBuffer = buffer.subarray(offset, offset + headerLen.value);
  offset += headerLen.value;

  // HIGH: Wrap JSON.parse in try-catch with meaningful error
  let header: MessageHeader;
  try {
    header = JSON.parse(headerBuffer.toString('utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse message header: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Read body length
  const bodyLen = decodeVarint(buffer, offset);
  offset += bodyLen.bytesRead;

  // CRITICAL: Bounds checking before reading body
  if (offset + bodyLen.value > buffer.length) {
    throw new Error('Buffer overflow: body length exceeds buffer size');
  }

  // Read body
  const body = buffer.subarray(offset, offset + bodyLen.value);
  offset += bodyLen.value;

  // Read signature length
  const sigLen = decodeVarint(buffer, offset);
  offset += sigLen.bytesRead;

  // CRITICAL: Bounds checking before reading signature
  if (offset + sigLen.value > buffer.length) {
    throw new Error('Buffer overflow: signature length exceeds buffer size');
  }

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
  // HIGH: Handle empty buffer case
  if (buffer.length === 0) {
    throw new Error('Cannot decode varint from empty buffer');
  }

  if (offset >= buffer.length) {
    throw new Error('Offset exceeds buffer length');
  }

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

  // HIGH: Check if we completed the varint
  if (shift > 0 && bytesRead === 0) {
    throw new Error('Incomplete varint: unexpected end of buffer');
  }

  return { value, bytesRead };
}
