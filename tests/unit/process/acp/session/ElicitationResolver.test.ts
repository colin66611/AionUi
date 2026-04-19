/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ElicitationResolver } from '@process/acp/session/ElicitationResolver';
import type { AcpElicitationFormModeRequest, AcpElicitationUrlModeRequest } from '@/common/types/acpTypes';

describe('ElicitationResolver', () => {
  let resolver: ElicitationResolver;

  beforeEach(() => {
    resolver = new ElicitationResolver({});
  });

  describe('Form Mode', () => {
    it('should create pending request when evaluate is called', async () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Which database should I use?',
        requestedSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              title: 'Database',
              oneOf: [
                { const: 'mysql', title: 'MySQL' },
                { const: 'postgres', title: 'PostgreSQL' },
              ],
            },
          },
          required: ['database'],
        },
      };

      const uiCallback = vi.fn();

      // evaluate returns a promise that resolves when user responds
      const evaluatePromise = resolver.evaluate(request, uiCallback);

      // UI should have been called with correct data
      expect(uiCallback).toHaveBeenCalledTimes(1);
      const uiData = uiCallback.mock.calls[0][0];
      expect(uiData.message).toBe('Which database should I use?');
      expect(uiData.mode).toBe('form');
      expect(uiData.requestedSchema).toEqual(request.requestedSchema);
      expect(uiData.callId).toBeDefined();

      // Resolve the elicitation
      resolver.resolve(uiData.callId, { database: 'postgres' });

      const result = await evaluatePromise;
      expect(result.action).toBe('accept');
      expect(result.content).toEqual({ database: 'postgres' });
    });

    it('should handle decline action', async () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Enter your name',
        requestedSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      };

      const uiCallback = vi.fn();
      const evaluatePromise = resolver.evaluate(request, uiCallback);

      const uiData = uiCallback.mock.calls[0][0];
      resolver.decline(uiData.callId, 'User cancelled');

      const result = await evaluatePromise;
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('User cancelled');
    });

    it('should handle cancel action', async () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Enter value',
        requestedSchema: { type: 'object' },
      };

      const uiCallback = vi.fn();
      const evaluatePromise = resolver.evaluate(request, uiCallback);

      const uiData = uiCallback.mock.calls[0][0];
      resolver.cancel(uiData.callId);

      await expect(evaluatePromise).rejects.toThrow('Elicitation request was cancelled');
    });
  });

  describe('URL Mode', () => {
    it('should handle URL mode elicitation', async () => {
      const request: AcpElicitationUrlModeRequest = {
        sessionId: 'test-session',
        mode: 'url',
        url: 'https://example.com/auth',
        message: 'Please authorize via OAuth',
      };

      const uiCallback = vi.fn();
      const evaluatePromise = resolver.evaluate(request, uiCallback);

      expect(uiCallback).toHaveBeenCalledTimes(1);
      const uiData = uiCallback.mock.calls[0][0];
      expect(uiData.mode).toBe('url');
      expect(uiData.url).toBe('https://example.com/auth');
      expect(uiData.message).toBe('Please authorize via OAuth');

      resolver.resolve(uiData.callId, { authorized: true });

      const result = await evaluatePromise;
      expect(result.action).toBe('accept');
    });
  });

  describe('Error Handling', () => {
    it('should handle resolve for unknown callId silently', () => {
      // Should not throw
      expect(() => resolver.resolve('unknown-id', {})).not.toThrow();
    });

    it('should handle decline for unknown callId silently', () => {
      expect(() => resolver.decline('unknown-id')).not.toThrow();
    });

    it('should handle cancel for unknown callId silently', () => {
      expect(() => resolver.cancel('unknown-id')).not.toThrow();
    });

    it('should reject all pending when rejectAll is called', async () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Test',
        requestedSchema: {},
      };

      const uiCallback = vi.fn();
      const evaluatePromise1 = resolver.evaluate(request, uiCallback);
      const evaluatePromise2 = resolver.evaluate(request, uiCallback);

      resolver.rejectAll(new Error('Connection lost'));

      await expect(evaluatePromise1).rejects.toThrow('Connection lost');
      await expect(evaluatePromise2).rejects.toThrow('Connection lost');
      expect(resolver.hasPending).toBe(false);
    });
  });

  describe('hasPending', () => {
    it('should return true when there are pending requests', async () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Test',
        requestedSchema: {},
      };

      expect(resolver.hasPending).toBe(false);

      const uiCallback = vi.fn();
      resolver.evaluate(request, uiCallback);

      expect(resolver.hasPending).toBe(true);

      const uiData = uiCallback.mock.calls[0][0];
      resolver.resolve(uiData.callId, {});

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resolver.hasPending).toBe(false);
    });
  });

  describe('getPendingIds', () => {
    it('should return all pending elicitation IDs', () => {
      const request: AcpElicitationFormModeRequest = {
        sessionId: 'test-session',
        mode: 'form',
        message: 'Test',
        requestedSchema: {},
      };

      const uiCallback = vi.fn();
      resolver.evaluate(request, uiCallback);
      resolver.evaluate(request, uiCallback);

      const ids = resolver.getPendingIds();
      expect(ids).toHaveLength(2);
      expect(ids[0]).not.toBe(ids[1]); // Unique IDs
    });
  });
});
