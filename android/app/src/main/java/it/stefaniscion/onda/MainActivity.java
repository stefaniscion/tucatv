package it.stefaniscion.onda;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state) {registerPlugin(NativePlayerPlugin.class);super.onCreate(state);getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(bridge!=null&&bridge.getWebView()!=null)bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('tuca-back'))",null);else moveTaskToBack(true);}});}

}
