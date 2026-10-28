const sharp = require('sharp');

const enhanceImage = (input, resize = {}) => sharp(input)
  .resize({
    width: 2400,
    height: 2400,
    fit: 'inside',
    withoutEnlargement: true,
    ...resize
  })
  .grayscale()
  .normalize()
  .sharpen()
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

const preparePrescriptionImage = async (filePath) => {
  const orientedBuffer = await sharp(filePath, { limitInputPixels: 40000000 })
    .rotate()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const metadata = await sharp(orientedBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('The uploaded image has no readable dimensions.');
  }

  const enhanced = await enhanceImage(orientedBuffer);
  const detailImages = [];
  const longestSide = Math.max(metadata.width, metadata.height);
  if (longestSide > 2600) {
    const splitPortrait = metadata.height >= metadata.width;
    const firstCrop = splitPortrait
      ? { left: 0, top: 0, width: metadata.width, height: Math.floor(metadata.height / 2) }
      : { left: 0, top: 0, width: Math.floor(metadata.width / 2), height: metadata.height };
    const secondCrop = splitPortrait
      ? {
          left: 0,
          top: firstCrop.height,
          width: metadata.width,
          height: metadata.height - firstCrop.height
        }
      : {
          left: firstCrop.width,
          top: 0,
          width: metadata.width - firstCrop.width,
          height: metadata.height
        };

    for (const crop of [firstCrop, secondCrop]) {
      const cropBuffer = await sharp(orientedBuffer).extract(crop).png().toBuffer();
      detailImages.push(await enhanceImage(cropBuffer, { width: 2200, height: 2200 }));
    }
  }

  return {
    buffer: enhanced,
    detailImages,
    mimeType: 'image/jpeg'
  };
};

module.exports = { preparePrescriptionImage };
