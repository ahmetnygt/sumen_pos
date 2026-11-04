const ICONS = new Set([
    'bira', 'şarap', 'kokteyl', 'viski', 'cin', 'votka', 'shot',
    'kahve', 'çay', 'meşrubat', 'su', 'yemek', 'burger', 'balık',
    'salata', 'tatlı', 'atıştırmalık', 'kahvaltı'
]);

function cleanIcon(value) {
    if (value == null || String(value).trim() === '') return null;
    const key = String(value).trim();
    if (!ICONS.has(key)) return false;
    return key;
}

function cleanPhoto(value) {
    if (value == null || value === '') return null;
    const photo = String(value);
    if (photo.length > 180 * 1024) return false;
    if (!photo.startsWith('data:image/jpeg;base64,')) return false;
    return photo;
}

const NAME_RULES = [
    ['kahvalt', 'kahvaltı'],
    ['atıştır', 'atıştırmalık'],
    ['atistir', 'atıştırmalık'],
    ['snack', 'atıştırmalık'],
    ['tatlı', 'tatlı'],
    ['tatli', 'tatlı'],
    ['dessert', 'tatlı'],
    ['salata', 'salata'],
    ['salad', 'salata'],
    ['balık', 'balık'],
    ['balik', 'balık'],
    ['fish', 'balık'],
    ['burger', 'burger'],
    ['meşrubat', 'meşrubat'],
    ['mesrubat', 'meşrubat'],
    ['viski', 'viski'],
    ['whiskey', 'viski'],
    ['whisky', 'viski'],
    ['kokteyl', 'kokteyl'],
    ['cocktail', 'kokteyl'],
    ['martini', 'kokteyl'],
    ['kahve', 'kahve'],
    ['coffee', 'kahve'],
    ['çay', 'çay'],
    ['cay', 'çay'],
    ['şarap', 'şarap'],
    ['sarap', 'şarap'],
    ['wine', 'şarap'],
    ['votka', 'votka'],
    ['vodka', 'votka'],
    ['bira', 'bira'],
    ['beer', 'bira'],
    ['stout', 'bira'],
    ['lager', 'bira'],
    ['shot', 'shot'],
    ['cin', 'cin'],
    ['gin', 'cin'],
    ['yemek', 'yemek'],
    ['food', 'yemek']
];

function iconForName(name) {
    const text = String(name || '').toLocaleLowerCase('tr-TR');
    for (const [needle, icon] of NAME_RULES) {
        if (text.includes(needle)) return icon;
    }
    if (text === 'su' || text.startsWith('su ') || text.includes(' su')) return 'su';
    return null;
}

module.exports = { ICONS, cleanIcon, cleanPhoto, iconForName };
