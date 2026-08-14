package com.example.twilightvault

import android.content.Context
import android.os.BatteryManager
import android.webkit.JavascriptInterface
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class WebAppInterface(private val context: Context) {
    @JavascriptInterface
    fun getBatteryLevel(): Int {
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100)
    }

    @JavascriptInterface
    fun getSystemTime(): String {
        return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
    }

    @JavascriptInterface
    fun setEmulatorRunning(running: Boolean) {
        // The JavaScript side owns the emulator lifecycle. This method is exposed
        // for future native telemetry and keeps the bridge symmetrical.
    }
}