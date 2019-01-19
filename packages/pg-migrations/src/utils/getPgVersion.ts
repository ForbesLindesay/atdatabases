import {Connection} from '@databases/pg';

export default async function getPgVersion(
  connection: Connection,
): Promise<[number, number]> {
  // e.g. PostgreSQL 10.1 on x86_64-apple-darwin16.7.0, compiled by Apple LLVM version 9.0.0 (clang-900.0.38), 64-bit
  const [{version: sqlVersionString}] = await connection.query(
    connection.sql`SELECT version();`,
  );
  const match = /PostgreSQL (\d+).(\d+)/.exec(sqlVersionString);
  if (match) {
    const [, major, minor] = match;
    return [parseInt(major, 10), parseInt(minor, 10)];
  }
  return [0, 0];
}
