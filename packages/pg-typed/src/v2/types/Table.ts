import {DeleteStatement, InsertStatement, UpdateStatement} from './Statements';
import {SelectQuery} from './Queries';
import {TypedDatabaseQuery} from './TypedDatabaseQuery';
import WhereCondition from './WhereCondition';
import {SelectionSetObject} from './SelectionSet';
import {Columns} from './Columns';

export default interface Table<TRecord, TInsertParameters = TRecord>
  extends SelectQuery<TRecord> {
  one(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord | undefined>;
  oneRequired(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord>;
  first(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord | undefined>;

  insert(...records: TInsertParameters[]): InsertStatement<TRecord>;
  update(
    whereValues: WhereCondition<TRecord>,
    updateValues:
      | Partial<TRecord>
      | ((column: Columns<TRecord>) => Partial<SelectionSetObject<TRecord>>),
  ): UpdateStatement<TRecord>;
  delete(whereValues: WhereCondition<TRecord>): DeleteStatement<TRecord>;
}
