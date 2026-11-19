import type { SampleAnimalImage } from '../types';

export const HERO_HAND_VISUAL = '/src/assets/images/hero_hand_sign_1795069185506.jpg';

export const SAMPLE_ANIMAL_IMAGES: SampleAnimalImage[] = [
  {
    id: 'snow-leopard',
    label: 'Alpine Big Cat',
    regionHint: 'High-altitude Himalayan ridge',
    imageUrl: '/src/assets/images/animal_snow_leopard_1795069183027.jpg',
    alt: 'Snow leopard resting on a sunlit Himalayan rocky ridge',
  },
  {
    id: 'scarlet-macaw',
    label: 'Rainforest Parrot',
    regionHint: 'Neotropical canopy branch',
    imageUrl: '/src/assets/images/animal_scarlet_macaw_1795069184448.jpg',
    alt: 'Scarlet macaw perched on a mossy rainforest branch',
  },
  {
    id: 'red-eyed-tree-frog',
    label: 'Canopy Amphibian',
    regionHint: 'Central American wet leaf',
    imageUrl: '/src/assets/images/animal_red_eyed_tree_frog_1795069183667.jpg',
    alt: 'Red-eyed tree frog clinging to a dewy tropical green leaf',
  },
  {
    id: 'sea-turtle',
    label: 'Marine Reptile',
    regionHint: 'Sunlit tropical coral reef',
    imageUrl: '/src/assets/images/animal_sea_turtle_1795069187962.jpg',
    alt: 'Green sea turtle gliding above a coral reef in turquoise water',
  },
];
