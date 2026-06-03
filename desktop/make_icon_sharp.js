const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function convert() {
  try {
    console.log('Resizing with sharp...');
    await sharp('C:\\Users\\William\\.gemini\\antigravity\\brain\\5adfefab-617d-4041-aeb7-ceb1a9e16b68\\media__1780268162507.png')
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile('icon_temp.png');
      
    console.log('Converting to ico...');
    const buf = await pngToIco('icon_temp.png');
    if (!fs.existsSync('build')) fs.mkdirSync('build');
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Icon generated successfully!');
  } catch (e) {
    console.error(e);
  }
}
convert();
