/**
 * Configuração global do mundo.
 *
 * ESCALA: 1 unidade do Three.js = 1 metro.
 * A imagem de referência (512 x 288 px) é mapeada a 8 m por pixel,
 * gerando um continente de 4096 m x 2304 m. O personagem tem 1,80 m,
 * portas ~2,1 m, casas 6-10 m, árvores de 4 m (arbustos) a 40 m (sumaúmas).
 *
 * Eixos: x = oeste → leste, z = norte → sul (o topo da imagem é o norte).
 * Coordenadas normalizadas (u, v) = posição na imagem de 0 a 1.
 */
export const WORLD = {
  width: 4096,
  depth: 2304,
  // Resolução da malha do terreno (~4,3 m entre vértices).
  segmentsX: 960,
  segmentsZ: 540,
  waterLevel: 0,
  seed: 20240611,
  // Lago central + ilha da Vila Renascimento (medidos na imagem).
  lake: { u: 0.5, v: 0.486, radius: 640, islandRadius: 235 },
  /**
   * Litoral norte do centro (onde as montanhas da taiga iam até a borda do mapa):
   * falésias rochosas e uma faixa de seixos no pé, fechando a ilha. Estreito de
   * propósito: a Vila Presa de Gelo fica a 82 m da borda — a terra fica intacta
   * a partir de `coast + jag + face` m (≤ 80). null = sem falésias (mapa antigo).
   */
  northCliffs: {
    coast: 22, // m da borda até a linha d'água (mínimo)
    coastVar: 14, // + variação suave ao longo da costa
    jag: 6, // + recortes curtos (falésia irregular)
    face: 38, // m de face de rocha até o topo
    shore: 20, // m de faixa de seixos/mar raso antes da água funda
    shelf: 1.0, // altura (m) da faixa de seixos no pé da falésia
    seaFloor: -18, // fundo do mar junto à costa
  },
};

/**
 * >>> AQUI ENTRA A IMAGEM BASE DO CONTINENTE <<<
 *
 * - imageUrl: usada no minimapa e no mapa grande (tecla M). Não é esticada
 *   sobre o terreno; o relevo e os biomas são gerados em 3D.
 * - useAsBiomeMask: se true, a cor de cada pixel da imagem define o bioma
 *   (veja `maskColor` em biomes.js). Use uma imagem "pintada" com as cores
 *   planas de cada bioma para controle total do formato.
 * - heightmapUrl: imagem em tons de cinza (preto = fundo do mar,
 *   branco = pico mais alto). Se definida, substitui o relevo procedural
 *   mantendo os detalhes finos de cada bioma.
 */
export const REFERENCE_MAP = {
  imageUrl: `${(import.meta.env?.BASE_URL ?? "/")}assets/maps/continente-referencia.png`,
  useAsBiomeMask: false,
  heightmapUrl: null, // ex.: '/assets/maps/heightmap.png'
  heightmapScale: 260, // altura (m) do branco puro
  heightmapSeaLevel: 0.18, // valor de cinza (0..1) que corresponde ao nível do mar
};

export const PLAYER = {
  height: 1.8,
  radius: 0.35,
  walkSpeed: 4.2, // m/s
  sprintMultiplier: 2.0, // Shift: corrida = andar × isto
  get runSpeed() { return this.walkSpeed * this.sprintMultiplier; },
  swimSpeed: 2.0,
  jumpSpeed: 5.0,
  gravity: -18,
  fastTravelMultiplier: 7, // tecla F (ferramenta de protótipo)
  flySpeed: 30, // m/s no modo voo (tecla V)
  flyBoost: 5, // Shift no modo voo
  flyMaxHeight: 1500,
};


export const RENDER = {
  far: 4200,
  shadowMapSize: 4096, // sombras nítidas das copas de foto
  shadowRange: 110,
  grassRadius: 62,
  grassMaxInstances: 34000,
  treeChunkSize: 256,
  treeHighDetailDistance: 150,
  treeViewDistance: 1100,
};

export function uvToWorld(u, v) {
  return { x: (u - 0.5) * WORLD.width, z: (v - 0.5) * WORLD.depth };
}

export function worldToUv(x, z) {
  return { u: x / WORLD.width + 0.5, v: z / WORLD.depth + 0.5 };
}
