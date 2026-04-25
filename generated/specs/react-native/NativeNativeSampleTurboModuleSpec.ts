
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeNativeSampleTurboModuleSpecSpec extends TurboModule {
  voidFunc(): void;
  getBool(arg: boolean): void;
  getEnum(arg: Double): void;
  getNumber(arg: Double): void;
  getString(arg: string): void;
  getArray(arg: ReadonlyArray<unknown>): void;
  getObject(arg: UnsafeObject): void;
  getUnsafeObject(arg: UnsafeObject): void;
  getRootTag(arg: Double): void;
  getValue(x: Double, y: string, z: UnsafeObject): void;
  getValueWithCallback(callback: (...args: ReadonlyArray<unknown>) => void): void;
  getValueWithPromise(error: boolean): Promise<unknown>;
  voidFuncThrows(): void;
  getObjectThrows(arg: UnsafeObject): void;
  promiseThrows(): Promise<unknown>;
  voidFuncAssert(): void;
  getObjectAssert(arg: UnsafeObject): void;
  promiseAssert(): Promise<unknown>;
  getImageUrl(): Promise<unknown>;
}

export default TurboModuleRegistry.getEnforcing<NativeNativeSampleTurboModuleSpecSpec>(
  'NativeSampleTurboModuleSpec'
);
