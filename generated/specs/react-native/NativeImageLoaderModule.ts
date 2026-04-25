
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, Int32, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeImageLoaderModuleSpec extends TurboModule {
  getSize(uriString: string): Promise<Int32>;
  getSize(uriString: string, promise: unknown, headers: UnsafeObject, promise: unknown, requestIdAsDouble: Double, promise: unknown, ReadableArray: unknown, promise: unknown, Int: unknown, request: unknown): Promise<Int32>;
  getSizeWithHeaders(uriString: string, headers: UnsafeObject): Promise<unknown>;
  queryCache(uris: ReadonlyArray<unknown>): Promise<unknown>;
}

export default TurboModuleRegistry.getEnforcing<NativeImageLoaderModuleSpec>(
  'ImageLoaderModule'
);
