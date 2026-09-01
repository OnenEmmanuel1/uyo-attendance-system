/**
 * gps.js — Geolocation capture using the browser's native API
 * Returns a Promise resolving to { lat, lng, accuracy }
 */

function captureGPS(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    const defaults = {
      enableHighAccuracy: true,
      timeout:            15000,
      maximumAge:         5000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat:      position.coords.latitude,
          lng:      position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        let msg;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Location permission was denied. Please allow location access and try again.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Location information is unavailable. Please try again.';
            break;
          case err.TIMEOUT:
            msg = 'Location request timed out. Ensure GPS is enabled and try again.';
            break;
          default:
            msg = 'An unknown error occurred while getting location.';
        }
        reject(new Error(msg));
      },
      { ...defaults, ...options }
    );
  });
}
