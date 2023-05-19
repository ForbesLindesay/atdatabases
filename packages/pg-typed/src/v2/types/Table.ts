import {InsertStatement} from './Statements';
import {SelectQuery} from './Queries';
import {TypedDatabaseQuery} from './TypedDatabaseQuery';
import WhereCondition from './WhereCondition';

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
}
