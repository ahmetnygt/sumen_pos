export default function BrandMark({ brand, className = '' }) {
    if (!brand) return null;
    if (brand.logo_svg) {
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(brand.logo_svg)}`;
        return <img className={`brand-logo ${className}`.trim()} src={src} alt={brand.name || 'Firma'} />;
    }
    return <span className={`brand-name ${className}`.trim()}>{brand.name}</span>;
}
