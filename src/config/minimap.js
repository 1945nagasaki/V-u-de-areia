/**
 * Minimapa em tempo real (câmera ortográfica de cima).
 * - layer: camada do Three.js que a câmera do minimapa enxerga
 * - height: altura da câmera (m) — acima da montanha mais alta
 * - resolution: lado da textura (px) onde o minimapa é desenhado
 * - viewMeters: quantos metros o quadrado mostra (andando/rápido/voando)
 * - icons: etiqueta da colisão → cor do ícone da construção
 * O intervalo de atualização (a cada N quadros) vem do nível gráfico.
 */
export const MINIMAP = {
  layer: 2,
  height: 1500,
  resolution: 320,
  viewMeters: { walk: 420, fast: 1600, fly: 2400 },
  /** Luz mínima na vista de cima (o clima da Floresta Preta apaga o sol). */
  minLight: { sun: 2.2, hemi: 1.1 },
  icons: {
    house: 0xd8b07a,
    hut: 0xa8763e,
    ruin: 0x6a5a4a,
    stall: 0xe0c050,
    church: 0xf2ece0,
    cathedral: 0xf2ece0,
    mansion: 0xe8d8b8,
    clock: 0xe8d8b8,
    well: 0x5aa8d8,
    tower: 0x8a6a4a,
    tent: 0xc0603a,
    pond: 0x3a8ad0,
    fire: 0xff8a3a,
    mine: 0x3a3632,
    tree: 0x2f5a2a,
    workshop: 0xc8945a, // locais de trabalho (config/workplaces.js)
  },
};

/**
 * Mapa grande (tecla M): foto do continente inteiro, na mesma versão do
 * minimapa (mundo 3D visto de cima) — ver render/WorldMapRenderer.js.
 * - width/height: tamanho da foto (px), na proporção do continente (16:9)
 * - supersample: a foto é tirada N× maior e reduzida (bordas lisas)
 * - sea: mar plano (cor e opacidade sobre o fundo raso) e a cor do mar aberto
 * - light: luz fixa de cima (o mapa não escurece de noite nem na tempestade)
 */
export const WORLD_MAP = {
  width: 1024,
  height: 576,
  supersample: 2,
  sea: { color: 0x4a9fd0, opacity: 0.8, deep: 0x2a6f9c },
  light: { sun: 3.6, sunColor: 0xfff4e0, direction: [-0.35, 1, -0.3], hemi: 2.2, sky: 0xe8f0ff, ground: 0xa89a80 },
};
