import {DomainTypeMode} from './printers/printDomainType';
import {EnumTypeMode} from './printers/printEnumType';
import {FileName, FileID} from './FileName';
import {PrimaryKeyMode} from './printers/printClassDetails';

export default interface PrintOptions {
  domainTypeMode: DomainTypeMode;
  enumTypeMode: EnumTypeMode;
  primaryKeyMode: PrimaryKeyMode;
  resolveFilename: (file: FileID) => FileName;
}
