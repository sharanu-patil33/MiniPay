import jsQR from "jsqr";

// Reads a QR code from an image file and returns its text.
export function decodeQrFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const maxSize = 1000;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(url);
      if (result) resolve(result.data);
      else reject(new Error("No QR code found in this image"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };

    img.src = url;
  });
}