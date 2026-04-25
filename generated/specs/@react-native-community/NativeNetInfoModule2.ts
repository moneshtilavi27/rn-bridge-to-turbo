
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeNetInfoModuleSpec extends TurboModule {
  getCurrentState(requestedInterface: string): Promise<unknown>;
  addListener(eventName: string): void;
  configure(config: UnsafeObject): void;
  removeListeners(count: Double): void;
}

export default TurboModuleRegistry.getEnforcing<NativeNetInfoModuleSpec>(
  'NetInfoModule'
);
