const DEFAULT_IMAGE_QUALITY = 0.86;
const DEFAULT_MAX_DIMENSION = 1600;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function buildOptimizedFileName(fileName = "imagem") {
  const baseName = String(fileName || "imagem").replace(/\.[^.]+$/, "") || "imagem";
  return `${baseName}.webp`;
}

function calculateOutputSize(width, height, maxDimension) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const longestSide = Math.max(safeWidth, safeHeight);

  if (!maxDimension || longestSide <= maxDimension) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale))
  };
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(context, width, height) {
        context.drawImage(bitmap, 0, 0, width, height);
      },
      cleanup() {
        bitmap.close?.();
      }
    };
  }

  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Este navegador não oferece uma API compatível para otimizar imagens.");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Não foi possível decodificar a imagem selecionada."));
      image.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw(context, width, height) {
        context.drawImage(image, 0, 0, width, height);
      },
      cleanup() {
        URL.revokeObjectURL(objectUrl);
      }
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("O navegador não conseguiu gerar a versão otimizada da imagem."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function optimizeImageForUpload(
  file,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_IMAGE_QUALITY } = {}
) {
  if (!(file instanceof Blob)) {
    throw new TypeError("Arquivo de imagem inválido para otimização.");
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return {
      file,
      optimized: false,
      reason: "unsupported-type",
      originalSize: file.size,
      optimizedSize: file.size,
      originalWidth: null,
      originalHeight: null,
      outputWidth: null,
      outputHeight: null
    };
  }

  const decoded = await decodeImage(file);

  try {
    const outputSize = calculateOutputSize(decoded.width, decoded.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      throw new Error("Canvas 2D indisponível para otimizar a imagem.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    decoded.draw(context, outputSize.width, outputSize.height);

    const optimizedBlob = await canvasToBlob(canvas, "image/webp", quality);
    if (optimizedBlob.type !== "image/webp") {
      return {
        file,
        optimized: false,
        reason: "webp-unsupported",
        originalSize: file.size,
        optimizedSize: file.size,
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        outputWidth: decoded.width,
        outputHeight: decoded.height
      };
    }

    const originalName = file.name || "imagem";
    const shouldKeepOriginal = optimizedBlob.size >= file.size;

    if (shouldKeepOriginal) {
      return {
        file,
        optimized: false,
        reason: "no-size-gain",
        originalSize: file.size,
        optimizedSize: file.size,
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        outputWidth: decoded.width,
        outputHeight: decoded.height
      };
    }

    const optimizedFile = new File([optimizedBlob], buildOptimizedFileName(originalName), {
      type: "image/webp",
      lastModified: file.lastModified || Date.now()
    });

    return {
      file: optimizedFile,
      optimized: true,
      reason: outputSize.width !== decoded.width || outputSize.height !== decoded.height ? "resized-and-compressed" : "compressed",
      originalSize: file.size,
      optimizedSize: optimizedFile.size,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      outputWidth: outputSize.width,
      outputHeight: outputSize.height
    };
  } finally {
    decoded.cleanup?.();
  }
}
