const { Table } = require('../models');

exports.getAllTables = async (req, res) => {
    try {
        let tables = await Table.findAll({ order: [['id', 'ASC']] });
        
        // Eğer veritabanı boşsa (ilk kurulum), mekana varsayılan masaları fırlat
        if (tables.length === 0) {
            const defaultTables = [
                { name: 'Masa 1', status: 'Boş' },
                { name: 'Masa 2', status: 'Boş' },
                { name: 'Masa 3', status: 'Boş' },
                { name: 'VIP 1', status: 'Boş' },
                { name: 'VIP 2', status: 'Boş' },
                { name: 'Bar 1', status: 'Boş' },
                { name: 'Bar 2', status: 'Boş' },
                { name: 'Bahçe 1', status: 'Boş' }
            ];
            await Table.bulkCreate(defaultTables);
            tables = await Table.findAll({ order: [['id', 'ASC']] }); // Oluşturup tekrar çek
        }

        res.status(200).json(tables);
    } catch (error) {
        res.status(500).json({ message: 'Masalar getirilemedi.', error: error.message });
    }
};