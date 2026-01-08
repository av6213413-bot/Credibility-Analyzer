/**
 * Analysis Context
 * Provides analysis state management across the application
 * Requirements: 1.5, 1.6, 5.1, 5.2, 5.3
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { AnalysisInput, AnalysisResult, AnalysisStage } from '@/types';
import type { APIError } from '@/types/api.types';
import { analysisApi } from '@/services/api';
import { storageService } from '@/services/storage';
import {
  analysisReducer,
  initialAnalysisState,
  type AnalysisState,
} from './analysisReducer';

export interface UseAnalysisReturn {
  status: AnalysisState['status'];
  stage: AnalysisStage | null;
  result: AnalysisResult | null;
  error: APIError | null;
  analyze: (input: AnalysisInput) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

interface AnalysisContextValue extends UseAnalysisReturn {}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

export interface AnalysisProviderProps {
  children: ReactNode;
}

export const AnalysisProvider: React.FC<AnalysisProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(analysisReducer, initialAnalysisState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (input: AnalysisInput): Promise<void> => {
    // Cancel any existing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    dispatch({ type: 'START_ANALYSIS' });

    try {
      const onStageChange = (stage: AnalysisStage) => {
        dispatch({ type: 'SET_STAGE', payload: stage });
      };

      const result =
        input.type === 'url'
          ? await analysisApi.analyzeUrl(input.value, { signal, onStageChange })
          : await analysisApi.analyzeText(input.value, { signal, onStageChange });

      dispatch({ type: 'ANALYSIS_SUCCESS', payload: result });

      // Persist to history on success (Requirement 8.1)
      storageService.addToHistory(result);
    } catch (error) {
      // Don't dispatch error for abort
      if ((error as Error).name === 'AbortError') {
        return;
      }

      const apiError: APIError =
        error && typeof error === 'object' && 'code' in error
          ? (error as APIError)
          : {
              code: 'UNKNOWN',
              message:
                error instanceof Error ? error.message : 'An unknown error occurred',
            };

      dispatch({ type: 'ANALYSIS_ERROR', payload: apiError });
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: 'RESET' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: AnalysisContextValue = {
    status: state.status,
    stage: state.stage,
    result: state.result,
    error: state.error,
    analyze,
    cancel,
    reset,
  };

  return (
    <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
  );
};

/**
 * Hook to access analysis context
 * @returns Analysis context value with state and actions
 * @throws Error if used outside of AnalysisProvider
 */
export const useAnalysis = (): UseAnalysisReturn => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};
