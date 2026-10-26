/**
 * @file server/middleware/correlationId.test.ts
 * Unit tests for correlation ID middleware.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { correlationIdMiddleware } from './correlationId.ts';
import { Request, Response } from 'express';

test('correlationIdMiddleware generates a new UUID when none is supplied', () => {
  const req = { headers: {} } as Request;
  let headerKey = '';
  let headerVal = '';
  const res = {
    setHeader(key: string, val: string) {
      headerKey = key;
      headerVal = val;
    },
  } as unknown as Response;

  let nextCalled = false;
  correlationIdMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.ok(nextCalled);
  assert.ok(typeof req.correlationId === 'string');
  assert.ok(req.correlationId.length > 20);
  assert.equal(headerKey, 'x-correlation-id');
  assert.equal(headerVal, req.correlationId);
});

test('correlationIdMiddleware preserves valid incoming x-correlation-id header', () => {
  const customId = 'client-req-98765-xyz';
  const req = { headers: { 'x-correlation-id': customId } } as unknown as Request;
  let headerVal = '';
  const res = {
    setHeader(_key: string, val: string) {
      headerVal = val;
    },
  } as unknown as Response;

  correlationIdMiddleware(req, res, () => {});

  assert.equal(req.correlationId, customId);
  assert.equal(headerVal, customId);
});
