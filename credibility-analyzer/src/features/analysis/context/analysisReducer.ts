/**
 * Analysis Reducer
 * Manages analysis state transitions
 * Requirements: 1.5, 1.6, 5.1, 5.2, 5.3
 */

import type { AnalysisResult, AnalysisStage } from '@/types';
import type { APIError } from '@/types/api.types';

export interface AnalysisState {
  status: 'idle' | 'loading' | 'success' | 'error';
  stage: AnalysisStage | null;
  result: AnalysisResult | null;
  error: APIError | null;
}

export type AnalysisAction =
  | { type: 'START_ANALYSIS' }
  | { type: 'SET_STAGE'; payload: AnalysisStage }
  | { type: 'ANALYSIS_SUCCESS'; payload: AnalysisResult }
  | { type: 'ANALYSIS_ERROR'; payload: APIError }
  | { type: 'RESET' };

export const initialAnalysisState: AnalysisState = {
  status: 'idle',
  stage: null,
  result: null,
  error: null,
};

export const analysisReducer = (
  state: AnalysisState,
  action: AnalysisAction
): AnalysisState => {
  switch (action.type) {
    case 'START_ANALYSIS':
      return {
        ...state,
        status: 'loading',
        stage: 'fetching',
        error: null,
        result: null,
      };
    case 'SET_STAGE':
      return {
        ...state,
        stage: action.payload,
      };
    case 'ANALYSIS_SUCCESS':
      return {
        status: 'success',
        stage: null,
        result: action.payload,
        error: null,
      };
    case 'ANALYSIS_ERROR':
      return {
        status: 'error',
        stage: null,
        result: null,
        error: action.payload,
      };
    case 'RESET':
      return initialAnalysisState;
    default:
      return state;
  }
};
