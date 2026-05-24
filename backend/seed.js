const { sequelize, User } = require('./src/models');

const seedAdmin = async () => {
    try {
        // Veritabanı bağlantısını doğrula
        await sequelize.authenticate();
        console.log('✅ Veritabanı bağlantısı başarılı. Tohumlama (Seed) başlıyor...');

        // Sistemde zaten bir Admin var mı diye bakıyoruz (Yanlışlıkla iki kez çalıştırırsan patlamasın)
        const adminExists = await User.findOne({ where: { role: 'Admin' } });

        if (adminExists) {
            console.log('⚠️ Sistemde zaten bir Admin hesabı mevcut. İşlem iptal edildi.');
            process.exit(0);
        }

        // Yeni Patron (Admin) hesabını oluşturuyoruz
        // DİKKAT: Şifreyi (pass_pin) düz metin olarak yazıyoruz! 
        // Çünkü User modeline yazdığımız o harika 'beforeCreate' kancası (hook) bunu yakalayıp otomatik kriptolayacak.
        await User.create({
            name: 'Admin',
            surname: 'Account',
            user_pin: '1111',
            pass_pin: '9999',
            role: 'Admin'
        });

        console.log('🎉 İlk Patron hesabı başarıyla oluşturuldu!');
        console.log('--------------------------------------------------');
        console.log('👤 KULLANICI PİN: 1111');
        console.log('🔑 ŞİFRE PİN: 9999');
        console.log('--------------------------------------------------');
        process.exit(0); // İşlem bitince terminalden otomatik çık
    } catch (error) {
        console.error('❌ Seed işlemi sırasında hata oluştu:', error);
        process.exit(1);
    }
};

seedAdmin();