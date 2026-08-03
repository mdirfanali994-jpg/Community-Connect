import { useEffect, useRef, useState } from 'react';
import { X, Camera, CameraOff, AlertTriangle, RefreshCw } from 'lucide-react';

const QRScanner = ({ onScan, onClose, workerId }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [error, setError] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initScanner = async () => {
      try {
        // Dynamically import html5-qrcode
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!mounted) return;

        // Check for camera availability
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices.length === 0) {
          setHasCamera(false);
          setError('No camera found on this device');
          return;
        }

        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Success callback — decode the QR
            if (mounted && !scanning) {
              setScanning(true);
              try {
                // Try to parse as JSON (our QR payload format)
                let parsed;
                try {
                  parsed = JSON.parse(decodedText);
                } catch (e) {
                  // If not JSON, treat the entire decoded text as visitorId
                  parsed = { visitorId: decodedText, communityId: '' };
                }

                const { visitorId, communityId } = parsed;

                if (!visitorId) {
                  setError('Invalid QR code: missing visitor ID');
                  setScanning(false);
                  return;
                }

                // Extract communityId from payload, or use empty
                onScan({
                  visitorId,
                  communityId: communityId || '',
                  workerId,
                  raw: decodedText,
                });
              } catch (err) {
                setError('Failed to decode QR code');
                setScanning(false);
              }
            }
          },
          (err) => {
            // QR scan error (non-fatal, keep scanning)
            if (mounted && err?.type !== 'NotFoundException') {
              console.warn('QR scan error:', err);
            }
          }
        );

        if (mounted) {
          setCameraStarted(true);
        }
      } catch (err) {
        console.error('QR scanner init error:', err);
        if (mounted) {
          if (err.name === 'NotAllowedError') {
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found on this device');
          } else {
            setError('Failed to start camera: ' + (err.message || 'Unknown error'));
          }
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      // Stop scanner on unmount
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().catch(() => {});
          html5QrCodeRef.current.clear().catch(() => {});
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [onScan, workerId, scanning]);

  const handleRetry = () => {
    setError('');
    setScanning(false);
    setCameraStarted(false);

    // Restart by forcing re-mount
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear().catch(() => {});
      } catch (e) {}
      html5QrCodeRef.current = null;
    }

    // Re-trigger via a small timeout
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scan Visitor QR</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-6">
          {error ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                {hasCamera ? (
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                ) : (
                  <CameraOff className="w-10 h-10 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {!hasCamera
                    ? 'Please use the Manual Visitor ID Lookup option instead.'
                    : 'Check camera permissions and try again.'}
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          ) : !cameraStarted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">Starting camera...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                id="qr-reader"
                ref={scannerRef}
                className="mx-auto overflow-hidden rounded-2xl border-2 border-primary/30"
                style={{ maxWidth: '320px' }}
              />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Point the camera at the visitor's QR code
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Camera Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
