const { Table } = require('../models');

exports.getAllTables = async (req, res) => {
    try {
        let tables = await Table.findAll({ order: [['id', 'ASC']] });

        // Eğer veritabanı boşsa (ilk kurulum), mekana varsayılan masaları fırlat
        if (tables.length === 0) {
            const defaultTables = [
                { name: 'Loca Sol', status: 'Boş' },
                { name: 'Loca Sağ', status: 'Boş' },
                { name: 'Bistro 1', status: 'Boş' },
                { name: 'Bistro 2', status: 'Boş' },
                { name: 'Bistro 3', status: 'Boş' },
                { name: 'Bistro 4', status: 'Boş' },
                { name: 'Bistro 5', status: 'Boş' },
                { name: 'Bistro 6', status: 'Boş' },
                { name: 'Bistro 7', status: 'Boş' },
                { name: 'Bistro 8', status: 'Boş' },
                { name: 'Bistro 9', status: 'Boş' },
                { name: 'Bistro 10', status: 'Boş' },
                { name: 'Bistro 11', status: 'Boş' },
                { name: 'Bistro 12', status: 'Boş' },
                { name: 'Bistro 13', status: 'Boş' },
                { name: 'Bistro 14', status: 'Boş' },
                { name: 'Bistro 15', status: 'Boş' },
            ];
            await Table.bulkCreate(defaultTables);
            tables = await Table.findAll({ order: [['id', 'ASC']] }); // Oluşturup tekrar çek
        }

        res.status(200).json(tables);
    } catch (error) {
        res.status(500).json({ message: 'Masalar getirilemedi.', error: error.message });
    }
};