---
id: validate-unicode
title: '@databases/validate-unicode'
sidebar_label: validate-unicode
---

The `@databases/validate-unicode` package validates and strips out invalid byte sequences from unicode strings in JavaScript. This is important because JavaScript does not enforce that strings with multi-byte characters are valid, but many other systems can crash or behave in unexpected ways when encountering these strings.

## API

```typescript
/**
 * Replace any un-matched surrogate pairs with \uFFFD so that
 * the string is guaranteed to be a valid utf8 string.
 */
export function removeInvalidUnicode(str: string): string;

/**
 * Return true if there are no un-matched surrogate pairs, otherwise
 * return false.
 */
export function isValidUnicode(str: string): boolean;

/**
 * Throw an error if the string has unmatched surrogate pairs
 */
export default function assertValidUnicode(str: string): string;
```
