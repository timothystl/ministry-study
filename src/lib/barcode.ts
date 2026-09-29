// Reads book barcodes from the camera. Browsers that have a built-in barcode reader use it; the
// rest (such as iPhone Safari) use a small reader that is downloaded only when scanning starts.
// The video never leaves the device.
interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => DetectorLike
  }
}
const constraints: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
}
export function cameraAvailable() {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}
export async function startScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<() => void> {
  if (window.BarcodeDetector) {
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] })
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.srcObject = stream
    await video.play()
    let stopped = false
    const timer = setInterval(() => {
      if (stopped || video.readyState < 2) return
      detector
        .detect(video)
        .then((codes) => codes[0] && onCode(codes[0].rawValue))
        .catch(() => undefined)
    }, 250)
    return () => {
      stopped = true
      clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
  const hints = new Map<number, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 200 })
  const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
    if (result) onCode(result.getText())
  })
  return () => controls.stop()
}
