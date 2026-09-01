/**
 * qr-scanner.js — Resilient client-side QR code scanning using html5-qrcode CDN
 * Includes multi-tier camera fallback to prevent AbortError / timeout errors.
 */

const QrScanner = (() => {
  let scanner = null;
  let isScanning = false;

  async function start(elementId, onSuccess, onError) {
    if (isScanning) return;

    try {
      // Ensure previous scanner instance is cleared
      if (scanner) {
        try { await scanner.stop(); } catch (_) {}
        scanner = null;
      }

      scanner = new Html5Qrcode(elementId, { verbose: false });
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const handleSuccess = (decodedText) => {
        let token = decodedText;
        try {
          const url = new URL(decodedText);
          const t   = url.searchParams.get('token');
          if (t) token = t;
        } catch (_) {}
        onSuccess(token);
      };

      // Tier 1: Try environment (back) camera
      try {
        await scanner.start({ facingMode: 'environment' }, config, handleSuccess, () => {});
        isScanning = true;
        return;
      } catch (e1) {
        // Tier 2: Try user (front / laptop) camera
        try {
          await scanner.start({ facingMode: 'user' }, config, handleSuccess, () => {});
          isScanning = true;
          return;
        } catch (e2) {
          // Tier 3: Try available camera devices by ID
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const camId = cameras[0].id;
            await scanner.start(camId, config, handleSuccess, () => {});
            isScanning = true;
            return;
          }
          throw e2 || e1;
        }
      }
    } catch (err) {
      isScanning = false;
      scanner = null;
      const msg = (err && err.message) ? err.message : String(err);
      if (/timeout|AbortError/i.test(msg)) {
        onError('Camera initialization timed out. Please verify no other app is using your webcam and try again, or enter the 6-character Session Token manually below.');
      } else if (/NotAllowedError|Permission/i.test(msg)) {
        onError('Camera permission denied. Please allow camera access in your browser settings or enter the Session Token manually.');
      } else if (/NotFoundError|DevicesNotFoundError/i.test(msg)) {
        onError('No camera detected on this device. Please enter the Session Token manually.');
      } else {
        onError('Unable to start camera: ' + msg + '. You can enter the Session Token manually below.');
      }
    }
  }

  function stop() {
    if (scanner && isScanning) {
      scanner.stop().then(() => {
        isScanning = false;
        scanner = null;
      }).catch(() => {
        isScanning = false;
        scanner = null;
      });
    }
  }

  return { start, stop, isScanning: () => isScanning };
})();
