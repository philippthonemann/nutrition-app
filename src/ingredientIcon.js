import {categoryFor, normalize} from '../lib/shopping.js';

const categoryIcons = {
  'Obst & Gemüse': 'leaf',
  'Milch & Käse': 'drop',
  'Fleisch & Fisch': 'utensils',
  'Brot & Gebäck': 'grain',
  'Zutaten & Gewürze': 'drop',
  'Fertig- & Tiefkühlprodukte': 'snow',
  'Getränke': 'glass',
  'Haushalt': 'home',
};

const productIcons = [
  [/knoblauch/, 'garlic'],
  [/ingwer/, 'ginger'],
  [/mango/, 'mango'],
  [/gurke/, 'cucumber'],
  [/spinat/, 'spinach'],
  [/chiasamen/, 'chia'],
  [/edamame/, 'edamame'],
  [/rote bete/, 'beet'],
  [/pflucksalat|blattsalat|kopfsalat/, 'lettuce'],
  [/^butter\b/, 'butter'],
  [/avocado/, 'avocado'],
  [/mozzarella|harzer|schmelzkase|protein kase/, 'cheese'],
  [/mineralwasser|volvic|\bwasser\b/, 'water'],
  [/makkaroni|maccaroni|fusilli|spaghetti|nudel/, 'pasta'],
  [/pizza/, 'pizza'],
  [/lachs|schlemmerfilet|bordelaise/, 'fish'],
  [/huftsteak|rindersteak/, 'steak'],
  [/tofu/, 'tofu'],
  [/skyr|joghurt|yogurt/, 'yogurt'],
  [/garnele|shrimp|prawn/, 'shrimp'],
  [/\b(?:olivenol|sesamol|rapsol|neutrales ol)\b/, 'oil'],
  [/erdnussmus|erdnussbutter|honig/, 'spread'],
  [/hahnchen|huhn|chicken/, 'chicken'],
  [/beeren|heidelbeer|himbeer|brombeer|erdbeer/, 'berries'],
  [/kreatin|creatin/, 'supplement'],
  [/whey|proteinpulver|vanille protein|protein shake|protein drink|hp drink|ehrmann hp/, 'shaker'],
  [/karott|mohre/, 'carrot'],
  [/zitrone|limette/, 'lemon'],
  [/zwiebel/, 'onion'],
  [/kartoffel/, 'potato'],
  [/tomat/, 'tomato'],
  [/kokosmilch|kokosnuss milch|kokoscreme/, 'coconut'],
  [/mandel(?:milch|drink)|hafer(?:milch|drink)|soja(?:milch|drink)|milch/, 'milk'],
  [/banan/, 'banana'],
  [/apfel/, 'apple'],
  [/brot|brotchen|toast/, 'bread'],
  [/reis/, 'rice'],
  [/haferflocken|haferfl|musli/, 'grain'],
  [/brokkoli/, 'broccoli'],
  [/sojasauce|sojasosse|spezi|limonade/, 'bottle'],
  [/^(?:rote |gelbe |grune )?paprika\b/, 'pepper'],
  [/kaffee|espresso/, 'coffee'],
  [/eier|\bei\b/, 'egg'],
];

export function ingredientIcon(name, category) {
  const normalizedName = normalize(name);
  return productIcons.find(([pattern]) => pattern.test(normalizedName))?.[1]
    || categoryIcons[categoryFor(name, category)] || 'basket';
}
