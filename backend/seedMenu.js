const { sequelize, Category, Product } = require('./src/models');

const seedMenu = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Veritabanı bağlantısı başarılı. Dolaplar dolduruluyor...');

        // İçeride zaten menü var mı diye ufak bir kontrol
        const checkCategory = await Category.findOne();
        if (checkCategory) {
            console.log('⚠️ Sistemde zaten bir menü var. Üst üste binmemesi için işlem iptal edildi.');
            process.exit(0);
        }

        // 1. Önce Kategorileri Yaratıyoruz (Sümen Sarısı ve Koyu Tonlar)
        const catKokteyl = await Category.create({ name: 'İmza Kokteyller', color_code: '#8b0000' });
        const catShot = await Category.create({ name: 'Shotlar', color_code: '#4a4e69' });
        const catBira = await Category.create({ name: 'Biralar', color_code: '#e9b824' });
        const catAtistirmalik = await Category.create({ name: 'Atıştırmalıklar', color_code: '#d4a373' });

        // 2. Şimdi Ürünleri Bu Kategorilerin Altına Çakıyoruz
        await Product.bulkCreate([
            // Kokteyller
            { name: 'Moscow Mule', price: 350.00, category_id: catKokteyl.id },
            { name: 'Espresso Martini', price: 380.00, category_id: catKokteyl.id },
            { name: 'Lynchburg Lemonade', price: 360.00, category_id: catKokteyl.id },
            
            // Shotlar
            { name: 'Tekila (Olmeca)', price: 150.00, category_id: catShot.id },
            { name: 'B52', price: 180.00, category_id: catShot.id },
            { name: 'Jägermeister', price: 160.00, category_id: catShot.id },

            // Biralar
            { name: 'Fıçı Bira 50cl', price: 130.00, category_id: catBira.id },
            { name: 'Şişe Bira 33cl (İthal)', price: 160.00, category_id: catBira.id },

            // Atıştırmalıklar
            { name: 'Lüks Karışık Çerez', price: 200.00, category_id: catAtistirmalik.id },
            { name: 'Meyve Tabağı', price: 300.00, category_id: catAtistirmalik.id }
        ]);

        console.log('🎉 Menü başarıyla oluşturuldu! Kasaya geçebilirsiniz.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Hata çıktı usta:', error);
        process.exit(1);
    }
};

seedMenu();