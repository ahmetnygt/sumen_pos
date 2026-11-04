const { sequelize, Company, Branch, User, FloorSalon, FloorDecoration, Table, Category, Product } = require('../models');

const DUBLIN_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 64"><g fill="#1F7A3A"><circle cx="32" cy="18" r="10"/><circle cx="18" cy="34" r="10"/><circle cx="46" cy="34" r="10"/><path d="M32 30c2 8 2 16 0 26-2-10-2-18 0-26z"/></g><text x="76" y="42" fill="#F4F1E8" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700">The Dublin</text></svg>`;

const TABLES = [
    { name: 'Booth 1', canvas_x: 40, canvas_y: 40, canvas_w: 160, canvas_h: 100 },
    { name: 'Booth 2', canvas_x: 230, canvas_y: 40, canvas_w: 160, canvas_h: 100 },
    { name: 'Booth 3', canvas_x: 420, canvas_y: 40, canvas_w: 160, canvas_h: 100 },
    { name: 'Booth 4', canvas_x: 610, canvas_y: 40, canvas_w: 160, canvas_h: 100 },
    { name: 'Window', canvas_x: 40, canvas_y: 190, canvas_w: 180, canvas_h: 110 },
    { name: 'Snug', canvas_x: 260, canvas_y: 190, canvas_w: 180, canvas_h: 110 },
    { name: 'Corner', canvas_x: 480, canvas_y: 190, canvas_w: 180, canvas_h: 110 },
    { name: 'High 1', canvas_x: 40, canvas_y: 360, canvas_w: 120, canvas_h: 90 },
    { name: 'High 2', canvas_x: 190, canvas_y: 360, canvas_w: 120, canvas_h: 90 },
    { name: 'High 3', canvas_x: 340, canvas_y: 360, canvas_w: 120, canvas_h: 90 },
    { name: 'High 4', canvas_x: 490, canvas_y: 360, canvas_w: 120, canvas_h: 90 }
];

const MENU = [
    {
        name: 'Biralar',
        color_code: '#1F7A3A',
        products: [
            { name: 'Guinness Pint', price: 180 },
            { name: 'Kilkenny', price: 170 },
            { name: 'Lager Pint', price: 150 },
            { name: 'Cider', price: 160 }
        ]
    },
    {
        name: 'Viskiler',
        color_code: '#C4A15A',
        products: [
            { name: 'Jameson', price: 220 },
            { name: 'Tullamore Dew', price: 240 },
            { name: 'Proper Twelve', price: 260 }
        ]
    },
    {
        name: 'Kokteyller',
        color_code: '#D4A017',
        products: [
            { name: 'Irish Coffee', price: 190, instructions: 'Sıcak kahve, İrlanda viskisi, esmer şeker. Üstüne soğuk krema.' },
            { name: 'Baby Guinness', price: 140, instructions: 'Kahve likörü bardağın altına, krema likörü üste.' }
        ]
    },
    {
        name: 'Yemekler',
        color_code: '#8C4A2F',
        products: [
            { name: 'Fish and Chips', price: 340, instructions: 'Morina, bira hamuru, patates. Limon ve tartar sos ile.' },
            { name: "Shepherd's Pie", price: 320, instructions: 'Kıyma, bezelye, havuç. Üstü patates püresi, fırında kızart.' },
            { name: 'Beef Stew', price: 300, instructions: 'Dana, soğan, patates, stout. Ekmek ile servis.' }
        ]
    }
];

async function createCompany() {
    const t = await sequelize.transaction();
    try {
        const company = await Company.create({
            name: 'The Dublin',
            code: '2000',
            is_active: true,
            accent_color: '#1f7a3a',
            logo_svg: DUBLIN_LOGO
        }, { transaction: t });
        const branch = await Branch.create({
            company_id: company.id,
            name: 'Temple Bar',
            code: '2001',
            is_active: true
        }, { transaction: t });
        await FloorSalon.create({
            branch_id: branch.id,
            name: 'Salon',
            sort_order: 0
        }, { transaction: t });
        await User.create({
            name: 'Liam',
            surname: 'Murphy',
            user_pin: '2000',
            pass_pin: '2000',
            role: 'Admin',
            company_id: company.id,
            branch_id: null
        }, { transaction: t });
        await User.create({
            name: 'Aoife',
            surname: 'Kelly',
            user_pin: '2001',
            pass_pin: '2001',
            role: 'Garson',
            company_id: company.id,
            branch_id: branch.id
        }, { transaction: t });
        await User.create({
            name: 'Sean',
            surname: 'Byrne',
            user_pin: '2002',
            pass_pin: '2002',
            role: 'Mutfak',
            company_id: company.id,
            branch_id: branch.id
        }, { transaction: t });
        await t.commit();
        return company;
    } catch (error) {
        await t.rollback();
        throw error;
    }
}

async function ensureFloor(company) {
    const branch = await Branch.findOne({ where: { company_id: company.id, code: '2001' } });
    if (!branch) return;
    let salon = await FloorSalon.findOne({
        where: { branch_id: branch.id },
        order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    if (!salon) {
        salon = await FloorSalon.create({ branch_id: branch.id, name: 'Salon', sort_order: 0 });
    }
    const tableCount = await Table.count({ where: { branch_id: branch.id } });
    if (tableCount === 0) {
        for (const table of TABLES) {
            await Table.create({
                ...table,
                branch_id: branch.id,
                salon_id: salon.id,
                status: 'Boş'
            });
        }
    }
    const decorCount = await FloorDecoration.count({ where: { branch_id: branch.id } });
    if (decorCount === 0) {
        await FloorDecoration.create({
            branch_id: branch.id,
            salon_id: salon.id,
            kind: 'bar',
            label: 'Bar',
            canvas_x: 40,
            canvas_y: 640,
            canvas_w: 720,
            canvas_h: 90
        });
    }
}

async function ensureMenu(company) {
    const productCount = await Product.count({ where: { company_id: company.id } });
    if (productCount > 0) return;
    for (const group of MENU) {
        const category = await Category.create({
            name: group.name,
            color_code: group.color_code,
            company_id: company.id
        });
        for (const item of group.products) {
            await Product.create({
                name: item.name,
                price: item.price,
                instructions: item.instructions || null,
                is_active: true,
                category_id: category.id,
                company_id: company.id
            });
        }
    }
}

const seedLocalDummy = async () => {
    let company = await Company.findOne({ where: { code: '2000' } });
    if (!company) company = await createCompany();
    if (company.logo_svg !== DUBLIN_LOGO) {
        await company.update({ logo_svg: DUBLIN_LOGO });
    }
    await ensureFloor(company);
    await ensureMenu(company);
};

module.exports = { seedLocalDummy };
