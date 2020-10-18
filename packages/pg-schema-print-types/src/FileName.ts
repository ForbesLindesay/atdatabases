export type FileName = string & {__brand?: 'FileName'};
export type FileID =
  | {type: 'class'; name: string}
  | {type: 'domain'; name: string}
  | {type: 'enum'; name: string};
