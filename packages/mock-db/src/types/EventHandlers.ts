import {SQLQuery} from '@databases/sql/web';

export default interface EventHandlers {
  onConnectionOpened?: () => void;
  onConnectionClosed?: () => void;
  onQueryStart?: (
    query: SQLQuery,
    formattedQuery: {
      readonly text: string;
      readonly values: readonly unknown[];
    },
  ) => void;
  onQueryResults?: (
    query: SQLQuery,
    formattedQuery: {
      readonly text: string;
      readonly values: readonly unknown[];
    },
    results: unknown[],
  ) => void;
  onQueryError?: (
    query: SQLQuery,
    formattedQuery: {
      readonly text: string;
      readonly values: readonly unknown[];
    },
    error: Error,
  ) => void;
}
