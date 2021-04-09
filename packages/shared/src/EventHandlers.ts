import type {SQLQuery} from '@databases/sql';

export default interface EventHandlers {
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
