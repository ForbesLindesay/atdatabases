/**
 * !!! This file is autogenerated do not edit by hand !!!
 *
 * Generated by: @databases/pg-schema-print-types
 * Checksum: X9RAi3U3tSW3TcaEMMT3DvHCVZMyj2Z6KhTIYAXWDkoHAzbX8zY3t5EEliJEdK2ueM8Bsmx/quhx3P8MU6JTUg==
 */

// eslint:disable
// tslint:disable

import Users from './users'

interface Photos {
  caption: (string) | null
  cdn_url: string & {__brand?: "url"}
  id: number & {readonly __brand?: 'photos_id'}
  metadata: unknown
  owner_user_id: Users['id']
}
export default Photos;

interface Photos_InsertParameters {
  caption?: (string) | null
  cdn_url: string & {__brand?: "url"}
  id?: number & {readonly __brand?: 'photos_id'}
  metadata: unknown
  owner_user_id: Users['id']
}
export {Photos_InsertParameters}
