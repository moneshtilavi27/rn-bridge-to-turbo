import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Int32, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeMyModuleSpec extends TurboModule {
  sendEvent(name: string, value: Int32): void;
  toggle(enabled: boolean): void;
  getData(id: string): Promise<string>;
  getData(id: string, name: string): Promise<string>;
  getData(id: string, name: string, age: string): Promise<string>;
  sendList(items: ReadonlyArray<string>): void;
  sendMap(map: UnsafeObject): void;
  withCallback(name: string, callback: (...args: ReadonlyArray<unknown>) => void): void;
  complexMethod(id: string, count: Int32, enabled: boolean, data: ReadonlyArray<UnsafeObject>, options: UnsafeObject): Promise<unknown>;
  finalMethod(id: string): void;
  staticMethod(id: string): void;
}

export default TurboModuleRegistry.getEnforcing<NativeMyModuleSpec>(
  'MyModule'
);