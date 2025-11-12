# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Retrofit and Moshi classes
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.squareup.moshi.** { *; }
-keep interface com.squareup.moshi.** { *; }
-keep class retrofit2.** { *; }

# Keep data classes
-keep class com.petwash.weatherplanner.Forecast { *; }
-keep class com.petwash.weatherplanner.Main { *; }
-keep class com.petwash.weatherplanner.Weather { *; }
