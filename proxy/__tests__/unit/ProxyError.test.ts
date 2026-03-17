/**
 * Unit Tests - ProxyError
 */

import { ProxyError, ErrorCodes } from '../../src/types';

describe('ProxyError', () => {
  it('should create error with default status code', () => {
    const error = new ProxyError(ErrorCodes.INTERNAL_ERROR, 'Something went wrong');

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ProxyError');
  });

  it('should create error with custom status code', () => {
    const error = new ProxyError(ErrorCodes.UNAUTHORIZED, 'Not allowed', 401);

    expect(error.message).toBe('Not allowed');
    expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(error.statusCode).toBe(401);
  });

  it('should be instanceof Error', () => {
    const error = new ProxyError(ErrorCodes.INTERNAL_ERROR, 'Test');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof ProxyError).toBe(true);
  });
});

describe('ErrorCodes', () => {
  it('should have all error codes', () => {
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCodes.INVALID_REQUEST).toBe('INVALID_REQUEST');
    expect(ErrorCodes.NODE_NOT_FOUND).toBe('NODE_NOT_FOUND');
    expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });
});
