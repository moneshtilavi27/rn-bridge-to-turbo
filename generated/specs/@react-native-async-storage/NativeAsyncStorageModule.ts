
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';


export interface NativeAsyncStorageModuleSpec extends TurboModule {
  getValues(db: string, keys: ReadonlyArray<unknown>): Promise<unknown>;
  setValues(db: string, values: ReadonlyArray<unknown>): Promise<unknown>;
  removeValues(db: string, keys: ReadonlyArray<unknown>): Promise<unknown>;
  getKeys(db: string): Promise<unknown>;
  clearStorage(db: string): Promise<unknown>;
  legacy_multiGet(keys: ReadonlyArray<unknown>): Promise<unknown>;
  legacy_multiSet(kvPairs: ReadonlyArray<unknown>): Promise<unknown>;
  legacy_getAllKeys(): Promise<unknown>;
  legacy_multiRemove(keys: ReadonlyArray<unknown>): Promise<unknown>;
  legacy_multiMerge(kvPairs: ReadonlyArray<unknown>): Promise<unknown>;
  legacy_clear(): Promise<unknown>;
}

export default TurboModuleRegistry.getEnforcing<NativeAsyncStorageModuleSpec>(
  'AsyncStorageModule'
);
