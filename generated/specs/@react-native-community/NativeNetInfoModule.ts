
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeNetInfoModuleSpec extends TurboModule {
  getCurrentState(requestedInterface: string): Promise<unknown>;
  configure(config: UnsafeObject): void;
  addListener(eventName: string): void;
  removeListeners(count: Double): void;
}

export default TurboModuleRegistry.getEnforcing<NativeNetInfoModuleSpec>(
  'NetInfoModule'
);
