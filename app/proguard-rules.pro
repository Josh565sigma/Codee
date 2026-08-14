# Keep the WebView bridge methods available to JavaScript in release builds.
-keepclassmembers class com.example.twilightvault.WebAppInterface {
    <methods>;
}