package it.stefaniscion.tucatv;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;

final class HttpRequest {
    static final String USER_AGENT = "TucaTV/0.12.1";

    private HttpRequest() {}

    static HttpURLConnection open(String value, int connectTimeout, int readTimeout, String accept) throws IOException {
        URLConnection raw = new URL(value).openConnection();
        if (!(raw instanceof HttpURLConnection)) throw new IOException("Unsupported protocol");
        HttpURLConnection connection = (HttpURLConnection) raw;
        configure(connection, connectTimeout, readTimeout, accept);
        return connection;
    }

    static void configure(HttpURLConnection connection, int connectTimeout, int readTimeout, String accept) {
        connection.setConnectTimeout(connectTimeout);
        connection.setReadTimeout(readTimeout);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("User-Agent", USER_AGENT);
        if (accept != null) connection.setRequestProperty("Accept", accept);
    }
}
