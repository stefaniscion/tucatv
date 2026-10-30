package it.stefaniscion.onda;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state) {registerPlugin(NativePlayerPlugin.class);super.onCreate(state);}
}
