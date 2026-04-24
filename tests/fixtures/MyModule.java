package com.example;

import com.facebook.react.bridge.*;
import java.util.*;

@ReactModule(name = MyModule.NAME)
public class MyModule extends ReactContextBaseJavaModule {

  public static final String NAME = "MyModule";

  @ReactMethod
  public void sendEvent(String name, int value) {}

  @ReactMethod
  public void toggle(boolean enabled) {}

  @ReactMethod
  public void getData(String id, Promise promise) {
    promise.resolve("hello");
  }

  @ReactMethod
  public void getData(String id, String name, Promise promise) {}

  @ReactMethod
  public void getData(String id, String name, String age, Promise promise) {}

  @ReactMethod
  public void sendList(List<String> items) {}

  @ReactMethod
  public void sendMap(ReadableMap map) {}

  @ReactMethod
  public void withCallback(String name, Callback callback) {
    callback.invoke("done");
  }

  @ReactMethod
  public void complexMethod(
    String id,
    int count,
    boolean enabled,
    List<Map<String, Object>> data,
    ReadableMap options,
    Promise promise
  ) {}

  @ReactMethod
  public final void finalMethod(String id) {}

  @ReactMethod
  public static void staticMethod(String id) {}
}