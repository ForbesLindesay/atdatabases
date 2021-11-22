import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {FormatConfig} from '@databases/sql';

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

export default pgFormat;
