
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Int32 } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeMyKotlinModuleSpec extends TurboModule {
  getData(id: string): Promise<string>;
  getData(id: string, name: string): Promise<string>;
  sendEvent(name: string, value: Int32): void;
}

export default TurboModuleRegistry.getEnforcing<NativeMyKotlinModuleSpec>(
  'MyKotlinModule'
);
