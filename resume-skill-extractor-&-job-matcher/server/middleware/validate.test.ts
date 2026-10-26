/**
 * @file server/middleware/validate.test.ts
 * Unit tests for input validation middleware and schemas.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBody, SkillExtractionBodySchema, JobMatchBodySchema } from './validate.ts';
import { Request, Response } from 'express';
import { AppError } from '../utils/errorHandler.ts';

test('validateBody passes valid payload to next()', () => {
  const req = {
    body: { resumeText: 'Senior Software Engineer with 8 years of React experience.' },
  } as Request;
  const res = {} as Response;
  let nextError: unknown = null;

  const middleware = validateBody(SkillExtractionBodySchema);
  middleware(req, res, (err) => {
    nextError = err;
  });

  assert.ok(!nextError);
  assert.equal(req.body.resumeText, 'Senior Software Engineer with 8 years of React experience.');
});

test('validateBody catches invalid payload and passes 400 VALIDATION_ERROR to next()', () => {
  const req = {
    body: { resumeText: 'short' }, // Less than min 10 chars
  } as Request;
  const res = {} as Response;
  let nextError: unknown = null;

  const middleware = validateBody(SkillExtractionBodySchema);
  middleware(req, res, (err) => {
    nextError = err;
  });

  assert.ok(nextError instanceof AppError);
  const appErr = nextError as AppError;
  assert.equal(appErr.statusCode, 400);
  assert.equal(appErr.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(appErr.details));
});

test('JobMatchBodySchema rejects missing required job fields', () => {
  const req = {
    body: {
      profile: {
        id: 'p1',
        fullName: 'Jane Doe',
        skills: [],
        experience: [],
        education: [],
        projects: [],
      },
      jobs: [], // Must have at least 1 job
    },
  } as Request;
  const res = {} as Response;
  let nextError: unknown = null;

  const middleware = validateBody(JobMatchBodySchema);
  middleware(req, res, (err) => {
    nextError = err;
  });

  assert.ok(nextError instanceof AppError);
  const appErr = nextError as AppError;
  assert.equal(appErr.statusCode, 400);
  assert.equal(appErr.code, 'VALIDATION_ERROR');
});
