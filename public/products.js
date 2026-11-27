// The catalogue of blank products an artist can customise.
// Shared by the browser and the server (the server loads it to validate orders), so keep it plain data.
// Artists can customise the whole of any product.

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
  Indigo: '#2E3F63', Wheat: '#C99A57', Pink: '#E8A1BD', Sky: '#8CC0E8', Mustard: '#D9A62E', Lilac: '#B9A5E0', Mint: '#A8DCC2'
};
const colors = (...names) => names.map(n => [n, SWATCH[n]]);
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PRODUCTS = [
  { id: 'tote', name: 'Tote bag', group: 'bags', from: 12, colors: colors('Sand', 'White', 'Black', 'Navy', 'Red', 'Forest'), sizes: [] },
  { id: 'backpack', name: 'Backpack', group: 'bags', from: 35, colors: colors('Black', 'Navy', 'Grey', 'Forest', 'Red', 'Sand'), sizes: [] },
  { id: 'sleeve', name: 'Laptop sleeve', group: 'bags', from: 22, colors: colors('Black', 'Grey', 'Navy', 'Sand', 'Pink', 'Mint'), sizes: ['13 inch', '14 inch', '15-16 inch'] },
  { id: 'mouse', name: 'Computer mouse', group: 'tech', from: 15, colors: colors('Black', 'White', 'Grey', 'Pink', 'Sky', 'Lilac'), sizes: [] },
  { id: 'mousepad', name: 'Mouse pad / desk mat', group: 'tech', from: 14, colors: colors('Black', 'Grey', 'Navy', 'Sand'), sizes: ['Standard', 'Large desk mat'] },
  { id: 'case', name: 'Phone case', group: 'tech', from: 14, colors: colors('Black', 'White', 'Pink', 'Sky', 'Mint', 'Lilac'), sizes: ['iPhone 15', 'iPhone 16', 'Pixel 8', 'Galaxy S24'] },
  { id: 'tee', name: 'T-shirt', group: 'apparel', from: 16, colors: colors('White', 'Black', 'Navy', 'Red', 'Sand', 'Forest', 'Grey'), sizes: CLOTHING_SIZES },
  { id: 'hoodie', name: 'Hoodie', group: 'apparel', from: 32, colors: colors('Black', 'Grey', 'Navy', 'Forest', 'Sand', 'Mustard'), sizes: CLOTHING_SIZES },
  { id: 'jeans', name: 'Jeans', group: 'apparel', from: 25, colors: colors('Indigo', 'Black', 'Grey', 'Sand', 'White'), sizes: ['28', '30', '32', '34', '36'] },
  { id: 'jersey', name: 'Jersey', group: 'apparel', from: 22, colors: colors('White', 'Black', 'Navy', 'Red', 'Forest'), sizes: CLOTHING_SIZES },
  { id: 'boots', name: 'Boots & sneakers', group: 'apparel', from: 35, colors: colors('Black', 'Wheat', 'White', 'Navy', 'Red'), sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
  { id: 'mug', name: 'Mug', group: 'drinkware', from: 9, colors: colors('White', 'Black', 'Navy', 'Red', 'Mustard', 'Mint'), sizes: [] },
  { id: 'bottle', name: 'Water bottle', group: 'drinkware', from: 18, colors: colors('White', 'Black', 'Navy', 'Sky', 'Pink', 'Forest'), sizes: ['500 ml', '750 ml'] },
  { id: 'notebook', name: 'Notebook', group: 'paper', from: 8, colors: colors('Black', 'Navy', 'Red', 'Sand', 'Forest', 'Pink'), sizes: ['A5', 'A6'] },
  { id: 'poster', name: 'Framed print', group: 'paper', from: 20, colors: colors('Black', 'White', 'Sand', 'Navy'), sizes: ['A4', 'A3', 'A2'] }
];

if (typeof module !== 'undefined') module.exports = { PRODUCTS, PRODUCT_GROUPS };
