const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function convert() {
  try {
    console.log('Reading image...');
    const image = await Jimp.read('C:\\Users\\William\\.gemini\\antigravity\\brain\\5adfefab-617d-4041-aeb7-ceb1a9e16b68\\media__1780268162507.png');
    const maxDim = Math.max(image.bitmap.width, image.bitmap.height);
    
    console.log('Padding to square...');
    const background = new Jimp(maxDim, maxDim, 0x00000000);
    
    const x = (maxDim - image.bitmap.width) / 2;
    const y = (maxDim - image.bitmap.height) / 2;
    
    background.composite(image, x, y);
    background.resize(256, 256);
    
    await background.writeAsync('icon_temp.png');
    
    console.log('Converting to .ico...');
    const buf = await pngToIco('icon_temp.png');
    if (!fs.existsSync('build')) fs.mkdirSync('build');
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Icon generated successfully!');
  } catch (err) {
    console.error('Error generating icon:', err);
  }
}
convert();
