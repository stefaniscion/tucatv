package it.stefaniscion.tucatv;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;

/** Uses the same bundled catalogues as the web interface and desktop host. */
final class I18n {

    private static final Map<String, JSONObject> catalogues = new ConcurrentHashMap<>();

    static String language(Context context) {
        String fallback = "it".equals(Locale.getDefault().getLanguage()) ? "it" : "en";
        return context.getSharedPreferences("tucatv-settings", 0).getString("language", fallback);
    }

    static void setLanguage(Context context, String language) {
        if (!"it".equals(language) && !"en".equals(language)) throw new IllegalArgumentException(
            "Unsupported language"
        );
        context.getSharedPreferences("tucatv-settings", 0).edit().putString("language", language).apply();
    }

    static String text(Context context, String key) {
        String language = language(context);
        JSONObject catalogue = catalogues.get(language);
        if (catalogue == null) {
            try (InputStream input = context.getAssets().open("public/locales/" + language + ".json")) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] block = new byte[8192];
                int count;
                while ((count = input.read(block)) != -1) bytes.write(block, 0, count);
                catalogue = new JSONObject(bytes.toString("UTF-8"));
                catalogues.put(language, catalogue);
            } catch (Exception ignored) {
                return key;
            }
        }
        return catalogue.optString(key, key);
    }
}
