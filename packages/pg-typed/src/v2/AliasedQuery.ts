import {Columns} from './types/Columns';

import SelectQuery from './SelectQuery';
import {JoinableQueryLeft, JoinableQueryRight} from './types/JoinableQuery';

export default interface AliasedQuery<TAlias extends string, TRecord>
  extends SelectQuery<TRecord>,
    JoinableQueryRight<TAlias, TRecord>,
    JoinableQueryLeft<{[TKey in TAlias]: Columns<TRecord>}> {}
