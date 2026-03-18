import { useCallback, useMemo, useRef, useState } from 'react';
import {
  activateQrSession,
  completeQrSession,
  startQrSession,
  type ActivationResult,
  type QrPayload,
} from '@/lib/qrActivationApi';

export type ActivationState =
  | 'IDLE'
  | 'SCANNING'
  | 'VERIFYING'
  | 'READY'
  | 'ACTIVATING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

type HookState = {
  activationState: ActivationState;
  sessionId: string | null;
  activationToken: string | null;
  machineId: string | null;
  machineName: string | null;
  nayaxSessionId: string | null;
  priceCents: number | null;
  currency: string;
  startedAt: string | null;
  estimatedSeconds: number | null;
  error: string | null;
  errorCode: string | null;
};

const INITIAL_STATE: HookState = {
  activationState: 'IDLE',
  sessionId: null,
  activationToken: null,
  machineId: null,
  machineName: null,
  nayaxSessionId: null,
  priceCents: null,
  currency: 'ILS',
  startedAt: null,
  estimatedSeconds: null,
  error: null,
  errorCode: null,
};

export function useQrMachineActivation() {
  const [state, setState] = useState<HookState>(INITIAL_STATE);
  const sessionIdRef = useRef<string | null>(null);
  const activationTokenRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    activationTokenRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const activate = useCallback(async (qrPayload: QrPayload) => {
    setState(prev => ({ ...prev, activationState: 'VERIFYING', error: null, errorCode: null }));
    try {
      const result: ActivationResult = await activateQrSession(qrPayload);

      if (!result.success || !result.sessionId || !result.activationToken) {
        throw new Error(result.message || 'Activation failed');
      }

      sessionIdRef.current = result.sessionId;
      activationTokenRef.current = result.activationToken;

      setState(prev => ({
        ...prev,
        activationState: 'READY',
        sessionId: result.sessionId!,
        activationToken: result.activationToken!,
        machineId: result.machineId || null,
        machineName: result.machineName || null,
        nayaxSessionId: result.nayaxSessionId || null,
        priceCents: result.priceCents || null,
        currency: result.currency || 'ILS',
        error: null,
        errorCode: null,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        activationState: 'FAILED',
        error: err?.message || 'Activation failed',
        errorCode: err?.errorCode || null,
      }));
    }
  }, []);

  const start = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const activationToken = activationTokenRef.current;

    if (!sessionId || !activationToken) {
      setState(prev => ({ ...prev, activationState: 'FAILED', error: 'Missing session or activation token' }));
      return;
    }

    setState(prev => ({ ...prev, activationState: 'ACTIVATING', error: null, errorCode: null }));
    try {
      const result = await startQrSession({ sessionId, activationToken });

      setState(prev => ({
        ...prev,
        activationState: 'RUNNING',
        startedAt: result.startedAt || null,
        estimatedSeconds: result.estimatedSeconds || null,
        error: null,
        errorCode: null,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        activationState: 'FAILED',
        error: err?.message || 'Could not start session',
        errorCode: err?.errorCode || null,
      }));
    }
  }, []);

  const complete = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setState(prev => ({ ...prev, activationState: 'FAILED', error: 'Missing session' }));
      return;
    }

    try {
      await completeQrSession({ sessionId });
      setState(prev => ({ ...prev, activationState: 'COMPLETED', error: null, errorCode: null }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        activationState: 'FAILED',
        error: err?.message || 'Could not complete session',
        errorCode: err?.errorCode || null,
      }));
    }
  }, []);

  const canStart = useMemo(() => state.activationState === 'READY', [state.activationState]);
  const isRunning = useMemo(() => state.activationState === 'RUNNING', [state.activationState]);
  const isCompleted = useMemo(() => state.activationState === 'COMPLETED', [state.activationState]);

  return {
    ...state,
    activate,
    start,
    complete,
    reset,
    canStart,
    isRunning,
    isCompleted,
  };
}
