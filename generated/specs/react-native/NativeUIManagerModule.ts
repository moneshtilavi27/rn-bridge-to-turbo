
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Int32, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';


export interface NativeUIManagerModuleSpec extends TurboModule {
  getConstantsForViewManager(viewManagerName: string): void;
  getDefaultEventTypes(): void;
  removeRootView(rootViewTag: Int32): void;
  createView(tag: Int32, className: string, rootViewTag: Int32, props: UnsafeObject): void;
  updateView(tag: Int32, className: string, props: UnsafeObject): void;
  manageChildren(viewTag: Int32, moveFrom: ReadonlyArray<unknown>, moveTo: ReadonlyArray<unknown>, addChildTags: ReadonlyArray<unknown>, addAtIndices: ReadonlyArray<unknown>, removeFrom: ReadonlyArray<unknown>): void;
  setChildren(viewTag: Int32, childrenTags: ReadonlyArray<unknown>): void;
  measure(reactTag: Int32, callback: (...args: ReadonlyArray<unknown>) => void): void;
  measureInWindow(reactTag: Int32, callback: (...args: ReadonlyArray<unknown>) => void): void;
  measureLayout(tag: Int32, ancestorTag: Int32, errorCallback: (...args: ReadonlyArray<unknown>) => void, successCallback: (...args: ReadonlyArray<unknown>) => void): void;
  findSubviewIn(reactTag: Int32, point: ReadonlyArray<unknown>, callback: (...args: ReadonlyArray<unknown>) => void): void;
  viewIsDescendantOf(reactTag: Int32, ancestorReactTag: Int32, callback: (...args: ReadonlyArray<unknown>) => void): void;
  setJSResponder(reactTag: Int32, blockNativeResponder: boolean): void;
  clearJSResponder(): void;
  dispatchViewManagerCommand(reactTag: Int32, commandId: UnsafeObject, commandArgs: ReadonlyArray<unknown>): void;
  setLayoutAnimationEnabledExperimental(enabled: boolean): void;
  configureNextLayoutAnimation(config: UnsafeObject, success: (...args: ReadonlyArray<unknown>) => void, error: (...args: ReadonlyArray<unknown>) => void): void;
  sendAccessibilityEvent(tag: Int32, eventType: Int32): void;
}

export default TurboModuleRegistry.getEnforcing<NativeUIManagerModuleSpec>(
  'UIManagerModule'
);
