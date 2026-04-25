
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';


export interface NativeSampleLegacyModuleSpec extends TurboModule {
  voidFunc(): void;
  voidFunc(side: unknown, future: unknown, stringArg: string, mapArg: unknown, numberArg: unknown, stringArg: unknown): void;
  getValueWithCallback(callback: (...args: ReadonlyArray<unknown>) => void): void;
  getValueWithPromise(error: boolean, promise: unknown): Promise<unknown>;
  getValueWithPromise(error: boolean, promise: unknown, String: unknown, input: unknown, output: unknown): Promise<unknown>;
}

export default TurboModuleRegistry.getEnforcing<NativeSampleLegacyModuleSpec>(
  'SampleLegacyModule'
);
