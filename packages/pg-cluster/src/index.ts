import {Queryable} from '@databases/pg';
import Cluster from './Cluster';

export type {Cluster};

export default function createCluster(
  primary: Queryable,
  replicas: Queryable[]
) {
  return new Cluster(primary, replicas);
}
