import {
    BeerBottleIcon,
    BeerSteinIcon,
    BowlFoodIcon,
    BrandyIcon,
    CakeIcon,
    CheersIcon,
    CoffeeIcon,
    DropIcon,
    EggIcon,
    FishIcon,
    ForkKnifeIcon,
    HamburgerIcon,
    JarIcon,
    LeafIcon,
    MartiniIcon,
    OrangeSliceIcon,
    PopcornIcon,
    TeaBagIcon,
    WineIcon
} from '@phosphor-icons/react';

export const MENU_ICONS = [
    { key: 'bira', label: 'Bira' },
    { key: 'şarap', label: 'Şarap' },
    { key: 'kokteyl', label: 'Kokteyl' },
    { key: 'viski', label: 'Viski' },
    { key: 'cin', label: 'Cin' },
    { key: 'votka', label: 'Votka' },
    { key: 'shot', label: 'Shot' },
    { key: 'kahve', label: 'Kahve' },
    { key: 'çay', label: 'Çay' },
    { key: 'meşrubat', label: 'Meşrubat' },
    { key: 'su', label: 'Su' },
    { key: 'yemek', label: 'Yemek' },
    { key: 'burger', label: 'Burger' },
    { key: 'balık', label: 'Balık' },
    { key: 'salata', label: 'Salata' },
    { key: 'tatlı', label: 'Tatlı' },
    { key: 'atıştırmalık', label: 'Atıştırmalık' },
    { key: 'kahvaltı', label: 'Kahvaltı' }
];

const ICONS = {
    bira: BeerSteinIcon,
    şarap: WineIcon,
    kokteyl: MartiniIcon,
    viski: BrandyIcon,
    cin: OrangeSliceIcon,
    votka: BeerBottleIcon,
    shot: CheersIcon,
    kahve: CoffeeIcon,
    çay: TeaBagIcon,
    meşrubat: JarIcon,
    su: DropIcon,
    yemek: ForkKnifeIcon,
    burger: HamburgerIcon,
    balık: FishIcon,
    salata: LeafIcon,
    tatlı: CakeIcon,
    atıştırmalık: PopcornIcon,
    kahvaltı: EggIcon
};

export function MenuGlyph({ name, className = '' }) {
    const Icon = ICONS[name] || BowlFoodIcon;
    return <Icon className={`menu-glyph ${className}`.trim()} weight="bold" />;
}

export function ProductMark({ photo, icon, className = '' }) {
    if (photo) {
        return <img className={`prod-mark ${className}`.trim()} src={photo} alt="" />;
    }
    return <MenuGlyph name={icon} className={`prod-mark ${className}`.trim()} />;
}

export function readPhotoFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            const max = 320;
            const scale = Math.min(1, max / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            let quality = 0.72;
            let data = canvas.toDataURL('image/jpeg', quality);
            while (data.length > 180 * 1024 && quality > 0.4) {
                quality -= 0.08;
                data = canvas.toDataURL('image/jpeg', quality);
            }
            if (data.length > 180 * 1024) reject(new Error('Fotoğraf 180 KB sınırını aşıyor.'));
            else resolve(data);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Fotoğraf okunamadı.'));
        };
        image.src = url;
    });
}
