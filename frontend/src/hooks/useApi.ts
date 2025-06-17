import { useState, useCallback } from 'react';
import { LoadingState } from '../types';

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  status: LoadingState;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T>;
  reset: () => void;
}

export function useApi<T>(apiFunction: (...args: any[]) => Promise<T>): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    status: 'idle',
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      setState(prev => ({
        ...prev,
        status: 'loading',
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      }));

      try {
        const result = await apiFunction(...args);
        setState(prev => ({
          ...prev,
          data: result,
          status: 'success',
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
        }));
        return result;
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          status: 'error',
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: error.message || 'An error occurred',
        }));
        throw error;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      status: 'idle',
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}
