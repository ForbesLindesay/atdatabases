import {hash} from 'generate-alphabetic-name';
import numberToValidPort from './numberToValidPort';

export default function stringToValidPort(
  value: string,
  minPort: number,
  maxPort: number,
) {
  return numberToValidPort(hash(value), minPort, maxPort);
}
