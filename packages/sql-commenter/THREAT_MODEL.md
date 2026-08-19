# Threat Model

For `addContext`, given a function like:

```typescript
import {isValidUnicode} from '@databases/validate-unicode';

function prepareQuery(query: SQLQuery, contextJson: string) {
  if (typeof contextJson !== 'string') {
    return query;
  }

  let contextObj;
  try {
    contextObj = JSON.parse(contextJson);
  } catch {
    return query;
  }

  if (typeof contextObj !== 'object' || contextObj == null) {
    return query;
  }

  if (
    Object.entries(contextObj).some(
      ([k, v]) => typeof value !== 'string' || !k || !isValidUnicode(k),
    )
  ) {
    return query;
  }

  return addContext(query, contextObj);
}
```

If an attacker controls the value of `contextJson`, but not `query`, they should be unable to make the `prepareQuery` function throw, and they should be unable to make `prepareQuery` return an SQL query that behaves any differently than the query being passed in (other than the addition of the comment).
