// The catalogue of blank products an artist can customise.
// Shared by the browser and the server (the server loads it to validate orders), so keep it plain data.
// `area` is where artwork goes on the 400x300 mockup: [x, y, width, height].

const PRODUCT_GROUPS = [
  { id: 'bags', name: 'Bags' },
  { id: 'tech', name: 'Tech & desk' },
  { id: 'apparel', name: 'Apparel' },
  { id: 'drinkware', name: 'Mugs & bottles' },
  { id: 'paper', name: 'Paper & prints' },
  { id: 'digital', name: 'Digital art' }
];

const SWATCH = {
  Black: '#202024', White: '#F4F3EF', Navy: '#1F2D4D', Red: '#C8333B', Forest: '#2F5D45', Sand: '#D9C7A3', Grey: '#8E929B',
  Pink: '#E8A1BD', Sky: '#8CC0E8', Mustard: '#D9A62E', Lilac: '#B9A5E0', Mint: '#A8DCC2'
};
const colors = (...names) => names.map(n => [n, SWATCH[n]]);
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PRODUCTS = [
  { id: 'tote', name: 'Tote bag', group: 'bags', from: 12, colors: colors('Sand', 'White', 'Black', 'Navy', 'Red', 'Forest'), sizes: [], area: [140, 140, 120, 110] },
  { id: 'backpack', name: 'Backpack', group: 'bags', from: 35, colors: colors('Black', 'Navy', 'Grey', 'Forest', 'Red', 'Sand'), sizes: [], area: [150, 96, 100, 84] },
  { id: 'sleeve', name: 'Laptop sleeve', group: 'bags', from: 22, colors: colors('Black', 'Grey', 'Navy', 'Sand', 'Pink', 'Mint'), sizes: ['13 inch', '14 inch', '15-16 inch'], area: [92, 122, 216, 92] },
  { id: 'mouse', name: 'Computer mouse', group: 'tech', from: 15, colors: colors('Black', 'White', 'Grey', 'Pink', 'Sky', 'Lilac'), sizes: [], area: [160, 152, 80, 88] },
  { id: 'mousepad', name: 'Mouse pad / desk mat', group: 'tech', from: 14, colors: colors('Black', 'Grey', 'Navy', 'Sand'), sizes: ['Standard', 'Large desk mat'], area: [78, 108, 244, 104] },
  { id: 'case', name: 'Phone case', group: 'tech', from: 14, colors: colors('Black', 'White', 'Pink', 'Sky', 'Mint', 'Lilac'), sizes: ['iPhone 15', 'iPhone 16', 'Pixel 8', 'Galaxy S24'], area: [156, 108, 88, 140] },
  { id: 'tee', name: 'T-shirt', group: 'apparel', from: 16, colors: colors('White', 'Black', 'Navy', 'Red', 'Sand', 'Forest', 'Grey'), sizes: CLOTHING_SIZES, area: [150, 100, 100, 110] },
  { id: 'hoodie', name: 'Hoodie', group: 'apparel', from: 32, colors: colors('Black', 'Grey', 'Navy', 'Forest', 'Sand', 'Mustard'), sizes: CLOTHING_SIZES, area: [150, 115, 100, 95] },
  { id: 'mug', name: 'Mug', group: 'drinkware', from: 9, colors: colors('White', 'Black', 'Navy', 'Red', 'Mustard', 'Mint'), sizes: [], area: [116, 100, 132, 100] },
  { id: 'bottle', name: 'Water bottle', group: 'drinkware', from: 18, colors: colors('White', 'Black', 'Navy', 'Sky', 'Pink', 'Forest'), sizes: ['500 ml', '750 ml'], area: [164, 110, 72, 132] },
  { id: 'notebook', name: 'Notebook', group: 'paper', from: 8, colors: colors('Black', 'Navy', 'Red', 'Sand', 'Forest', 'Pink'), sizes: ['A5', 'A6'], area: [148, 84, 108, 140] },
  { id: 'poster', name: 'Framed print', group: 'paper', from: 20, colors: colors('Black', 'White', 'Sand', 'Navy'), sizes: ['A4', 'A3', 'A2'], area: [138, 62, 124, 176] }
];

if (typeof module !== 'undefined') module.exports = { PRODUCTS, PRODUCT_GROUPS };
