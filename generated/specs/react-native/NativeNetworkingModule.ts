
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';


export interface NativeNetworkingModuleSpec extends TurboModule {
  clearCookies(callback: (...args: ReadonlyArray<unknown>) => void): void;
  clearCookies(callback: unknown): void;
}

export default TurboModuleRegistry.getEnforcing<NativeNetworkingModuleSpec>(
  'NetworkingModule'
);
