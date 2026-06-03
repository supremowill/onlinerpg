export type Rarity = 'basic' | 'epic' | 'legendary';

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  visual: {
    shape: string;
    color: string;
  };
  desc: string;
}

export const ItemDatabase: Record<string, ItemDef> = {
  // 🟢 ITENS BÁSICOS (30)
  prisma_faiscas: { id: 'prisma_faiscas', name: 'Prisma de Faiscas', rarity: 'basic', visual: { shape: 'prism', color: '#FFA500' }, desc: '5% chance Queimadura' },
  cubo_toxico: { id: 'cubo_toxico', name: 'Cubo Tóxico', rarity: 'basic', visual: { shape: 'cube', color: '#90EE90' }, desc: '5% chance Veneno' },
  lamina_triangular: { id: 'lamina_triangular', name: 'Lâmina Triangular', rarity: 'basic', visual: { shape: 'triangle', color: '#FF0000' }, desc: '5% chance Sangramento' },
  cilindro_corrosivo: { id: 'cilindro_corrosivo', name: 'Cilindro Corrosivo', rarity: 'basic', visual: { shape: 'cylinder', color: '#006400' }, desc: '3% chance Corrosão' },
  orbe_enfermo: { id: 'orbe_enfermo', name: 'Orbe Enfermo', rarity: 'basic', visual: { shape: 'sphere', color: '#800080' }, desc: '2% chance Praga' },
  icosaedro_gelido: { id: 'icosaedro_gelido', name: 'Icosaedro Gélido', rarity: 'basic', visual: { shape: 'icosahedron', color: '#ADD8E6' }, desc: '1% chance Congelamento (1s)' },
  bloco_pesado: { id: 'bloco_pesado', name: 'Bloco Pesado', rarity: 'basic', visual: { shape: 'cube', color: '#808080' }, desc: '2% chance Atordoamento' },
  raizes_poligonais: { id: 'raizes_poligonais', name: 'Raízes Poligonais', rarity: 'basic', visual: { shape: 'diamond', color: '#8B4513' }, desc: '5% chance Enraizamento' },
  cone_lentidao: { id: 'cone_lentidao', name: 'Cone da Lentidão', rarity: 'basic', visual: { shape: 'cone', color: '#00008B' }, desc: '10% chance Lentidão (20%)' },
  luz_prismatica: { id: 'luz_prismatica', name: 'Luz Prismática', rarity: 'basic', visual: { shape: 'prism', color: '#FFFFFF' }, desc: '2% chance Cegueira' },
  esfera_mudo: { id: 'esfera_mudo', name: 'Esfera do Mudo', rarity: 'basic', visual: { shape: 'sphere', color: '#000000' }, desc: '5% chance Silenciamento' },
  espelho_distorcido: { id: 'espelho_distorcido', name: 'Espelho Distorcido', rarity: 'basic', visual: { shape: 'rectangle', color: '#C0C0C0' }, desc: '3% chance Confusão' },
  tetraedro_panico: { id: 'tetraedro_panico', name: 'Tetraedro do Pânico', rarity: 'basic', visual: { shape: 'tetrahedron', color: '#8A2BE2' }, desc: '2% chance Medo' },
  placa_provocador: { id: 'placa_provocador', name: 'Placa do Provocador', rarity: 'basic', visual: { shape: 'plane', color: '#FFFF00' }, desc: '-5% Dano recebido de inimigos Tauntados' },
  lente_fenda: { id: 'lente_fenda', name: 'Lente da Fenda', rarity: 'basic', visual: { shape: 'lens', color: '#00FFFF' }, desc: '5% chance Vulnerabilidade' },
  tijolo_exaustivo: { id: 'tijolo_exaustivo', name: 'Tijolo Exaustivo', rarity: 'basic', visual: { shape: 'rectangle', color: '#D2B48C' }, desc: '5% chance Fraqueza' },
  circulo_cansaco: { id: 'circulo_cansaco', name: 'Círculo do Cansaço', rarity: 'basic', visual: { shape: 'circle', color: '#D3D3D3' }, desc: '5% chance Exaustão' },
  seta_marcadora: { id: 'seta_marcadora', name: 'Seta Marcadora', rarity: 'basic', visual: { shape: 'arrow', color: '#FF0000' }, desc: '5% chance Marca' },
  cunha_serrilhada: { id: 'cunha_serrilhada', name: 'Cunha Serrilhada', rarity: 'basic', visual: { shape: 'wedge', color: '#C0C0C0' }, desc: '5% chance Anti-Cura' },
  cristal_vitalidade: { id: 'cristal_vitalidade', name: 'Cristal de Vitalidade', rarity: 'basic', visual: { shape: 'crystal', color: '#00FF00' }, desc: 'Aplica buff Regeneração em si mesmo' },
  vento_cubico: { id: 'vento_cubico', name: 'Vento Cúbico', rarity: 'basic', visual: { shape: 'cube', color: '#FFFFFF' }, desc: '+5% Move/Atk Speed' },
  estilhaco_furia: { id: 'estilhaco_furia', name: 'Estilhaço de Fúria', rarity: 'basic', visual: { shape: 'fragment', color: '#8B0000' }, desc: 'Abaixo de 20% HP, ativa Fúria (3s)' },
  mini_escudo_planar: { id: 'mini_escudo_planar', name: 'Mini-Escudo Planar', rarity: 'basic', visual: { shape: 'circle', color: '#FFD700' }, desc: 'Garante Aegis 1x na partida ao tomar dano fatal' },
  cacto_geometrico: { id: 'cacto_geometrico', name: 'Cacto Geométrico', rarity: 'basic', visual: { shape: 'cylinder', color: '#008000' }, desc: '5% chance Espinhos (5s) ao sofrer hit' },
  presa_poligono: { id: 'presa_poligono', name: 'Presa de Polígono', rarity: 'basic', visual: { shape: 'cone', color: '#8B0000' }, desc: '+2% Lifesteal Global' },
  peso_balanceador: { id: 'peso_balanceador', name: 'Peso Balanceador', rarity: 'basic', visual: { shape: 'sphere', color: '#708090' }, desc: '+10% HP, -5% Velocidade (Slow permanente)' },
  motor_hasteado: { id: 'motor_hasteado', name: 'Motor Hasteado', rarity: 'basic', visual: { shape: 'cube', color: '#A9A9A9' }, desc: '+10% MoveSpeed, -5% Dano Base' },
  frasco_sangue: { id: 'frasco_sangue', name: 'Frasco Quadrado de Sangue', rarity: 'basic', visual: { shape: 'cube', color: '#8B0000' }, desc: '+15% Dano de Sangramento (Bleed)' },
  frasco_veneno: { id: 'frasco_veneno', name: 'Frasco Quadrado de Veneno', rarity: 'basic', visual: { shape: 'cube', color: '#008000' }, desc: '+2 limite máximo de stacks de Veneno' },
  relogio_triangular: { id: 'relogio_triangular', name: 'Relógio Triangular', rarity: 'basic', visual: { shape: 'triangle', color: '#FFD700' }, desc: '+0.5s de duração para seus CCs' },

  // 🟣 ITENS ÉPICOS (10)
  dodecaedro_carnificina: { id: 'dodecaedro_carnificina', name: 'Dodecaedro da Carnificina', rarity: 'epic', visual: { shape: 'dodecahedron', color: '#FF0000' }, desc: 'Críticos contra inimigos com Bleed aplicam Fúria (2s)' },
  bastiao_gelo: { id: 'bastiao_gelo', name: 'Bastião de Gelo', rarity: 'epic', visual: { shape: 'cube', color: '#ADD8E6' }, desc: '<30% HP ativa Aegis (3s) e Congela em área (AoE 5m, 2s) (CD: 120s)' },
  casco_toxico: { id: 'casco_toxico', name: 'Casco Tóxico Farpado', rarity: 'epic', visual: { shape: 'hemisphere', color: '#006400' }, desc: '+15% Thorns. Quem toma dano de espinhos recebe 2 stacks Poison' },
  lamina_sanguessuga: { id: 'lamina_sanguessuga', name: 'Lâmina Sanguessuga', rarity: 'epic', visual: { shape: 'diamond', color: '#DC143C' }, desc: '+5% Lifesteal (dobra contra alvos Vulneráveis)' },
  epidemia_acida: { id: 'epidemia_acida', name: 'Epidemia Ácida', rarity: 'epic', visual: { shape: 'icosahedron', color: '#800080' }, desc: 'Sua Praga ao se espalhar após morte aplica 2 stacks de Corrosão' },
  olho_aterrorizante: { id: 'olho_aterrorizante', name: 'O Olho Aterrorizante', rarity: 'epic', visual: { shape: 'sphere', color: '#FFFFFF' }, desc: 'Se sofrer >15% HP em 1 hit melee, ativa Fear e Mark no atacante' },
  megafone_conico: { id: 'megafone_conico', name: 'Megafone Cônico', rarity: 'epic', visual: { shape: 'cone', color: '#FFD700' }, desc: 'A cada 30s aplica Taunt (AoE 10m) e te dá Aegis por 3s' },
  grilhoes_cansaco: { id: 'grilhoes_cansaco', name: 'Grilhões do Cansaço', rarity: 'epic', visual: { shape: 'cylinder', color: '#000000' }, desc: 'Alvos enraizados por você sofrem Exaustão com dobro do tempo' },
  pendulo_curativo: { id: 'pendulo_curativo', name: 'Pêndulo Curativo', rarity: 'epic', visual: { shape: 'prism', color: '#C0C0C0' }, desc: '10s sem tomar dano = forte Regen. Se tomar dano, aplica Mortal Wounds' },
  prisma_duelista: { id: 'prisma_duelista', name: 'Prisma do Duelista', rarity: 'epic', visual: { shape: 'prism', color: '#FFA500' }, desc: 'Ataques aplicam: 1º Fraqueza, 2º Ignite, 3º Confusion' },

  // 🟠 ITENS LENDÁRIOS (5)
  cubo_infinito: { id: 'cubo_infinito', name: 'Cubo do Infinito (Ciclo Vital)', rarity: 'legendary', visual: { shape: 'cube', color: '#FFD700' }, desc: 'A cada 10s cicla: Regen+Haste, Enrage puro, Aegis intermitente' },
  prisma_calamidade: { id: 'prisma_calamidade', name: 'Prisma da Calamidade (O Fim)', rarity: 'legendary', visual: { shape: 'pyramid', color: '#2F4F4F' }, desc: 'Dano físico = 0. Mas 100% ataques aplicam Super DoT (Poison, Acid, Ignite, Plague)' },
  tetraedro_distorcao: { id: 'tetraedro_distorcao', name: 'Tetraedro da Distorção Temporal', rarity: 'legendary', visual: { shape: 'tetrahedron', color: '#FF00FF' }, desc: 'Permanente +50% Speed. Inimigos <8m sofrem -70% Slow e Silence constante' },
  coroa_gelida: { id: 'coroa_gelida', name: 'Coroa Gélida do Lich', rarity: 'legendary', visual: { shape: 'circle', color: '#E0FFFF' }, desc: 'Ataques = Cleave de Gelo (Freeze 1s). Dano em alvo Freeze = 10% Lifesteal' },
  coracao_raziel: { id: 'coracao_raziel', name: 'O Coração Cúbico de Raziel', rarity: 'legendary', visual: { shape: 'cube', color: '#FF1493' }, desc: 'Engana Morte: Revive com 100% HP. Aplica Blind/Confusion na tela, ganha Aegis 4s (1x)' }
};
