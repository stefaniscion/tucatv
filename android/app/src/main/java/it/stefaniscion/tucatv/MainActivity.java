package it.stefaniscion.tucatv;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state) {registerPlugin(NativePlayerPlugin.class);super.onCreate(state);configureWindow();getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(bridge!=null&&bridge.getWebView()!=null)bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('tuca-back'))",null);else moveTaskToBack(true);}});}
 private void configureWindow() {
  getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));
  getWindow().setStatusBarColor(Color.BLACK);
  getWindow().setNavigationBarColor(Color.BLACK);
  if (Build.VERSION.SDK_INT >= 28) {
   WindowManager.LayoutParams attributes = getWindow().getAttributes();
   attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
   getWindow().setAttributes(attributes);
  }
  WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
  WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
  WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
  View content = findViewById(android.R.id.content);
  content.setBackgroundColor(Color.BLACK);
  if (bridge != null && bridge.getWebView() != null) bridge.getWebView().setBackgroundColor(Color.BLACK);
  ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
   Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
   Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
   Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
   // Keep status/navigation bars and keyboard clear, without a whole column
   // reserved for the side camera cutout in landscape. Insets update on rotation.
   view.setPadding(bars.left, Math.max(bars.top, cutout.top), bars.right,
       Math.max(Math.max(bars.bottom, cutout.bottom), keyboard.bottom));
   return WindowInsetsCompat.CONSUMED;
  });
  ViewCompat.requestApplyInsets(content);
 }
}
