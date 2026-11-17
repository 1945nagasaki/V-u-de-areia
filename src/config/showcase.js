/**
 * "Novidades — ir até lá": atalhos no mapa (tecla M) que levam o jogador ao
 * ponto certo para testar o que é novo, já virado para a coisa.
 * Posição relativa ao centro da vila (dx, dz em metros; +z = sul).
 * yaw da câmera: Math.PI = olhando para o norte, 0 = sul, +π/2 = leste, −π/2 = oeste.
 */
export const SHOWCASE = [
  { village: 'coroaAlta', title: 'Cidadela do Cume-Leão — Portão do Pé',
    hint: 'Segure W para subir a Escada pelos 5 terraços até o Topo.', dx: 3, dz: 138, yaw: Math.PI },
  { village: 'coroaAlta', title: 'Cidadela do Cume-Leão — o Topo',
    hint: 'Vista da Escada e da Avenida dos Leões. Use E no Gongo e no pedestal.', dx: -4, dz: -56, yaw: 0 },
  { village: 'maoCerrada', title: 'Areia-Funda — Portão do Pedágio',
    hint: 'Ande para dentro pela avenida até a Casa da Balança (cúpula).', dx: 150, dz: 0, yaw: -Math.PI / 2 },
  { village: 'maoCerrada', title: 'Areia-Funda — Quadro dos Devedores',
    hint: 'Aperte E na frente do muro de placas.', dx: -3, dz: 9, yaw: 0 },
  { village: 'espelhoTurvo', title: 'Espelho-Turvo — ponte sobre o lago',
    hint: 'Segure W para atravessar o lago pela ponte de corda.', dx: -36, dz: 70, yaw: Math.PI / 2 },
  { village: 'espelhoTurvo', title: 'Espelho-Turvo — Casa de Lavagem',
    hint: 'Aperte E em "Lavar-se": a barra de Sujeira zera.', dx: 0, dz: 129, yaw: 0 },
  { village: 'espelhoTurvo', title: 'Espelho-Turvo — Ilhota do Erro',
    hint: 'Pule pelas pedras de passagem até a ilhota.', dx: -28, dz: 0, yaw: Math.PI / 2 },
];
