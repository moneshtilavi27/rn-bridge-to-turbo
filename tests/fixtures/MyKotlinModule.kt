class MyKotlinModule : ReactContextBaseJavaModule() {
  override fun getName(): String = "MyKotlinModule"

  @ReactMethod
  fun getData(id: String, promise: Promise) {
    promise.resolve("hello")
  }

  @ReactMethod
  fun getData(id: String, name: String, promise: Promise) {
    promise.resolve("hello")
  }

  @ReactMethod
  fun sendEvent(name: String, value: Int) {
  }
}