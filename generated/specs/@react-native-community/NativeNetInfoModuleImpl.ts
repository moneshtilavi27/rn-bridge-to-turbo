
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';


export interface NativeNetInfoModuleImplSpec extends TurboModule {
  getCurrentState(requestedInterface: string): Promise<unknown>;
}

export default TurboModuleRegistry.getEnforcing<NativeNetInfoModuleImplSpec>(
  'NetInfoModuleImpl'
);
