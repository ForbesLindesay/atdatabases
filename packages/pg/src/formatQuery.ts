import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {SQLQuery, FormatConfig} from '@databases/sql';
import minify = require('pg-minify');

let minifiedCacheOld = new Map<string, string>();
let minifiedCacheNew = new Map<string, string>();

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

export default function formatQuery(
  query: SQLQuery,
  shouldMinify: boolean = process.env.NODE_ENV === 'production',
) {
  if (!shouldMinify) {
    return query.format(pgFormat);
  }
  const {text, values} = query.format(pgFormat);

  const cachedA = minifiedCacheNew.get(text);
  if (cachedA) {
    return {text: cachedA, values};
  }

  const cachedB = minifiedCacheOld.get(text);
  if (cachedB) {
    minifiedCacheOld.delete(text);
    return {text: addToCache(text, cachedB), values};
  }

  return {text: addToCache(text, minify(text)), values};
}

function addToCache(unminified: string, minified: string) {
  if (minifiedCacheNew.size > 50) {
    minifiedCacheOld.clear();
    [minifiedCacheOld, minifiedCacheNew] = [minifiedCacheNew, minifiedCacheOld];
  }
  minifiedCacheNew.set(unminified, minified);
  return minified;
}
