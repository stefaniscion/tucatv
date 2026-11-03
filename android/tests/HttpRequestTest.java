package it.stefaniscion.tucatv;

import java.net.HttpURLConnection;
import java.net.URL;

public final class HttpRequestTest {
    private static final class Connection extends HttpURLConnection {
        Connection() throws Exception { super(new URL("http://example.test/guide.xz")); }
        public void disconnect() {}
        public boolean usingProxy() { return false; }
        public void connect() {}
    }

    public static void main(String[] args) throws Exception {
        Connection connection = new Connection();
        HttpRequest.configure(connection, 15000, 30000, "application/octet-stream");
        if (!"TucaTV/1.12.3".equals(connection.getRequestProperty("User-Agent"))) throw new AssertionError("User-Agent");
        if (!"identity".equals(connection.getRequestProperty("Accept-Encoding"))) throw new AssertionError("encoding");
        if (!"application/octet-stream".equals(connection.getRequestProperty("Accept"))) throw new AssertionError("accept");
        if (!connection.getInstanceFollowRedirects()) throw new AssertionError("redirects");
        if (connection.getConnectTimeout() != 15000 || connection.getReadTimeout() != 30000) throw new AssertionError("timeouts");

        if (args.length == 1) {
            HttpURLConnection live = HttpRequest.open(args[0], 15000, 30000, "application/octet-stream");
            try {
                if (live.getResponseCode() < 200 || live.getResponseCode() >= 300) throw new AssertionError("HTTP " + live.getResponseCode());
                byte[] magic = new byte[6];
                try (java.io.InputStream input = live.getInputStream()) {
                    if (input.read(magic) != magic.length) throw new AssertionError("short response");
                }
                byte[] expected = {(byte) 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00};
                if (!java.util.Arrays.equals(magic, expected)) throw new AssertionError("not XZ");
            } finally {
                live.disconnect();
            }
        }
    }
}
