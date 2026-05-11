const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

const opts = {
  fitTo: { mode: 'width', value: 1024 },
  font: {
    fontFiles: [path.join(__dirname, '..', 'assets', 'fonts', 'Lobster-Regular.ttf')],
    loadSystemFonts: false,
    defaultFontFamily: 'Lobster',
  },
};

// 앱 아이콘: 파란 배경 + 흰 Clipu
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="220" fill="#2563EB"/>
  <text x="512" y="510"
        font-family="Lobster"
        font-weight="400"
        font-size="300"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
        letter-spacing="0">Clipu</text>
</svg>
`;

// 어댑티브 아이콘: 투명 배경 + 흰 Clipu (시스템이 파란 배경 추가)
const adaptiveIconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="510"
        font-family="Lobster"
        font-weight="400"
        font-size="300"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
        letter-spacing="0">Clipu</text>
</svg>
`;

// 스플래시: 흰 배경 + 파란 Clipu
const splashSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="white"/>
  <text x="512" y="510"
        font-family="Lobster"
        font-weight="400"
        font-size="300"
        fill="#2563EB"
        text-anchor="middle"
        dominant-baseline="central"
        letter-spacing="0">Clipu</text>
</svg>
`;

function render(svgString, outputPath) {
  const resvg = new Resvg(svgString, opts);
  const pngData = resvg.render();
  fs.writeFileSync(outputPath, pngData.asPng());
  console.log(`✓ ${outputPath}`);
}

render(iconSvg,         path.join(assetsDir, 'icon.png'));
render(adaptiveIconSvg, path.join(assetsDir, 'adaptive-icon.png'));
render(splashSvg,       path.join(assetsDir, 'splash-icon.png'));
console.log('\n완료!');
