/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpElicitationRequest, AcpElicitationResponse, ElicitationUIData } from '@/common/types/acpTypes';

// ─── ElicitationResolver ─────────────────────────────────────────

type PendingElicitation = {
  callId: string;
  resolve: (response: AcpElicitationResponse) => void;
  reject: (error: Error) => void;
  createdAt: number;
};

type ElicitationResolverConfig = {
  /** No auto mode for elicitation - always ask user */
  autoApproveAll?: boolean;
};

/**
 * Handles ACP Elicitation requests (form/url mode) from agents.
 * Similar to PermissionResolver but for collecting structured user input.
 *
 * Elicitation is used when an agent needs to ask the user a question
 * and collect a structured response based on a JSON Schema.
 */
export class ElicitationResolver {
  private readonly pending = new Map<string, PendingElicitation>();

  constructor(_config: ElicitationResolverConfig = {}) {
    // Elicitation always requires user interaction - no auto mode
  }

  get hasPending(): boolean {
    return this.pending.size > 0;
  }

  /**
   * Evaluate an elicitation request and delegate to UI for user input.
   *
   * @param request - The elicitation request from the agent
   * @param uiCallback - Callback to render the elicitation UI
   * @returns Promise that resolves when user provides input
   */
  async evaluate(
    request: AcpElicitationRequest,
    uiCallback: (data: ElicitationUIData) => void
  ): Promise<AcpElicitationResponse> {
    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return new Promise<AcpElicitationResponse>((resolve, reject) => {
      this.pending.set(callId, { callId, resolve, reject, createdAt: Date.now() });

      const uiData: ElicitationUIData = {
        callId,
        message: request.message ?? '',
        mode: request.mode,
        ...(request.mode === 'form' && { requestedSchema: request.requestedSchema }),
        ...(request.mode === 'url' && { url: request.url }),
        ...(request.meta && { meta: request.meta }),
      };

      uiCallback(uiData);
    });
  }

  /**
   * Resolve an elicitation with user input.
   *
   * @param callId - The elicitation request ID
   * @param content - The user-provided content
   */
  resolve(callId: string, content: Record<string, unknown>): void {
    const entry = this.pending.get(callId);
    if (!entry) return;
    this.pending.delete(callId);

    entry.resolve({ action: 'accept', content });
  }

  /**
   * Decline an elicitation request.
   *
   * @param callId - The elicitation request ID
   * @param reason - Optional reason for declining
   */
  decline(callId: string, reason?: string): void {
    const entry = this.pending.get(callId);
    if (!entry) return;
    this.pending.delete(callId);

    entry.resolve({ action: 'decline', ...(reason && { reason }) });
  }

  /**
   * Cancel an elicitation request (e.g., when session ends).
   *
   * @param callId - The elicitation request ID
   */
  cancel(callId: string): void {
    const entry = this.pending.get(callId);
    if (!entry) return;
    this.pending.delete(callId);

    entry.reject(new Error('Elicitation request was cancelled'));
  }

  /**
   * Reject all pending elicitations (e.g., when connection drops).
   *
   * @param error - The error to reject with
   */
  rejectAll(error: Error): void {
    for (const entry of this.pending.values()) {
      entry.reject(error);
    }
    this.pending.clear();
  }

  /**
   * Get all pending elicitation IDs.
   */
  getPendingIds(): string[] {
    return Array.from(this.pending.keys());
  }
}
