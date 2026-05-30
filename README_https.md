Current time: 2026-05-30T15:38:32+02:00
Working directory: /Users/peterdiel/workspaces/playground/ev-charging
Workspace root folder: /Users/peterdiel/workspaces/playground/ev-charging

To test geolocation on iPhone (requires HTTPS for location permissions):

## Method 1: ngrok tunnel (Recommended)
1. Start full dev server (client + server): `pnpm dev`
2. In another terminal: `ngrok http 5173`
3. Open the ngrok HTTPS URL on iPhone - location prompt will appear.
    ✅ API calls work because server is running.

## Method 2: mkcert + direct HTTPS
1. Generate certs (once):
    ```bash
    brew install mkcert
    mkcert -install
    mkcert localhost 127.0.0.1 ::1
    ```
2. Start server in terminal 1: `pnpm --filter ev-server dev`
3. Start client with HTTPS in terminal 2:
    ```bash
    pnpm --filter ev-client dev -- --host 0.0.0.0 --port 5173 --https --cert ./localhost+2.pem --key ./localhost+2-key.pem
    ```
4. Find your machine's IP address (e.g., `ipconfig getifaddr en0` on Mac or check network settings)
5. Access `https://[YOUR_MACHINE_IP]:5173` on iPhone (trust cert if prompted - you may see a certificate warning since cert is for localhost, but HTTPS connection is still secure enough for geolocation).
    ⚠️ Ensure server is running or API calls will fail.

## Uninstall mkcert certificates (if needed)
To remove the locally trusted CA certificate created by mkcert:
```bash
# Uninstall from system trust store
mkcert -uninstall

# Optionally remove mkcert CLI tool
brew uninstall mkcert

# Optionally delete certificate files (if you want to clean up)
rm -f ./localhost+2.pem ./localhost+2-key.pem
```

> 💡 **Why HTTPS?** iOS Safari blocks geolocation prompts on non-secure contexts (HTTP) except localhost. Both methods provide a secure context required for location permissions.