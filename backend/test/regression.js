process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = './data/regression.sqlite';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFile = path.resolve(__dirname, '../data/regression.sqlite');
for (const file of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
}

const {
    sequelize, Company, Branch, User, Table, Product, Ingredient, Recipe, BranchStock, Order, OrderItem, FloorDecoration, FloorSalon
} = require('../src/models');
const reservationController = require('../src/controllers/reservationController');
const orderService = require('../src/services/orderService');
const shiftService = require('../src/services/shiftService');
const branchController = require('../src/controllers/branchController');
const userController = require('../src/controllers/userController');
const reportController = require('../src/controllers/reportController');
const tableController = require('../src/controllers/tableController');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function invoke(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.body = payload; resolve(this); return this; }
        };
        Promise.resolve(handler(req, res)).catch(reject);
    });
}

async function main() {
    await sequelize.sync({ force: true });

    const company = await Company.create({ name: 'Deneme', code: '1001' });
    const branch = await Branch.create({ company_id: company.id, name: 'Merkez', code: '2001' });
    const keep = await Branch.create({ company_id: company.id, name: 'Duracak', code: '2002' });
    const cashier = await User.create({
        name: 'Kasa', surname: 'Bir', user_pin: '1000', pass_pin: '1000', role: 'Kasa',
        company_id: company.id, branch_id: branch.id
    });
    const admin = await User.create({
        name: 'Yonetici', surname: 'Bir', user_pin: '2000', pass_pin: '2000', role: 'Admin',
        company_id: company.id, branch_id: null
    });
    const product = await Product.create({ name: 'Cay', price: 100, company_id: company.id, is_active: true });
    const milk = await Ingredient.create({ name: 'Sut', unit: 'adet', company_id: company.id, stock_amount: 0 });
    const stockProduct = await Product.create({ name: 'Latte', price: 50, company_id: company.id, is_active: true });
    await Recipe.create({ product_id: stockProduct.id, option_id: null, ingredient_id: milk.id, amount_used: 3 });
    await BranchStock.create({ branch_id: branch.id, ingredient_id: milk.id, stock_amount: 1 });

    const tablePay = await Table.create({ name: 'Masa 1', branch_id: branch.id, status: 'Boş' });
    await orderService.addItemsToOrder(
        tablePay.id, cashier.id,
        [{ productId: product.id, quantity: 1, price: 1 }],
        branch.id, company.id, false
    );
    const priced = await OrderItem.findOne({ where: { product_id: product.id } });
    assert(Number(priced.price) === 100, 'istemci fiyatı yok sayılmadı');

    const partial = await orderService.processPayment(tablePay.id, 40, 'Nakit', [], branch.id);
    assert(partial.isFullyPaid === false, 'kısmi ödeme hesabı kapatmamalı');
    let openOrder = await Order.findOne({ where: { table_id: tablePay.id } });
    assert(openOrder.status === 'Açık' && Number(openOrder.paid_amount) === 40, 'kısmi ödeme 40 yazılmalı');

    await orderService.applyDiscount(tablePay.id, 'percent', 100, branch.id);
    openOrder = await Order.findOne({ where: { table_id: tablePay.id } });
    assert(openOrder.status === 'Açık' && Number(openOrder.discount_amount) === 60, 'iskonto adisyonu kapatmamalı');

    const closedPay = await orderService.processPayment(tablePay.id, 0, 'Nakit', [], branch.id);
    assert(closedPay.isFullyPaid === true, 'kalan sıfırken ödeme kapatmalı');

    const tableStock = await Table.create({ name: 'Masa 2', branch_id: branch.id, status: 'Boş' });
    let shortFailed = false;
    try {
        await orderService.addItemToOrder(tableStock.id, cashier.id, stockProduct.id, 1, [], branch.id, company.id, false);
    } catch (error) {
        shortFailed = error.code === 'STOCK_SHORT';
    }
    assert(shortFailed, 'stok uyarısı dönmeli');
    let milkRow = await BranchStock.findOne({ where: { branch_id: branch.id, ingredient_id: milk.id } });
    assert(Number(milkRow.stock_amount) === 1, 'onaysız satış stoku düşürmemeli');

    await orderService.addItemToOrder(tableStock.id, cashier.id, stockProduct.id, 1, [], branch.id, company.id, true);
    milkRow = await BranchStock.findOne({ where: { branch_id: branch.id, ingredient_id: milk.id } });
    assert(Number(milkRow.stock_amount) === -2, 'onaylı satış eksi stoka inebilmeli');

    const opened = await shiftService.openShift(branch.id, cashier.id, 100);
    assert(Number(opened.shift.starting_cash) === 100, 'açılış tutarı yazılmalı');
    let secondOpenFailed = false;
    try {
        await shiftService.openShift(branch.id, cashier.id, 10);
    } catch (error) {
        secondOpenFailed = error.message === 'Bu şubede açık vardiya var.';
    }
    assert(secondOpenFailed, 'ikinci açık vardiya reddedilmeli');

    const shiftProduct = await Product.create({ name: 'Su', price: 30, company_id: company.id, is_active: true });
    const tableShift = await Table.create({ name: 'Masa 3', branch_id: branch.id, status: 'Boş' });
    await orderService.addItemToOrder(tableShift.id, cashier.id, shiftProduct.id, 1, [], branch.id, company.id, false);
    await orderService.processPayment(tableShift.id, 30, 'Nakit', [], branch.id);
    const current = await shiftService.currentShift(branch.id);
    assert(current.nakit === 30 && current.revenue === 30, 'vardiya cirosu açılıştan sonraki nakit olmalı');
    assert(current.expected_cash === 130, 'beklenen kasa açılış artı nakit olmalı');
    const closedShift = await shiftService.closeShift(branch.id, 120);
    assert(closedShift.difference === -10 && closedShift.shift.status === 'Kapalı', 'kapanış farkı yazılmalı');
    const afterClose = await shiftService.currentShift(branch.id);
    assert(afterClose.shift === null && afterClose.revenue === 0, 'kapalı vardiya boş dönmeli');

    const report = await invoke(reportController.getSalesReport, {
        user: { branch_id: branch.id },
        query: { page: '1', limit: '1' }
    });
    assert(report.statusCode === 200 && report.body.records.length === 1, 'satış listesi sayfalanmalı');
    assert(report.body.total >= 2 && report.body.summary.total === 70, 'özet filtrenin tamamını tutmalı');
    assert(report.body.summary.indirim === 60, 'iskonto özetinde durmalı');
    assert(report.body.records[0].description && report.body.records[0].payments, 'kayıt açıklama ve tahsilat taşımalı');
    const reportPage2 = await invoke(reportController.getSalesReport, {
        user: { branch_id: branch.id },
        query: { page: '2', limit: '1' }
    });
    assert(reportPage2.body.records.length === 1 && reportPage2.body.page === 2, 'ikinci sayfa gelmeli');

    const oldHash = admin.pass_pin;
    const pinUpdate = await invoke(userController.updateUser, {
        user: { company_id: company.id },
        params: { id: String(admin.id) },
        body: { name: 'Yeni', surname: 'Ad', pin: '2222', password: '', role: 'Admin' }
    });
    assert(pinUpdate.statusCode === 200 && pinUpdate.body.user.user_pin === '2222', 'PIN güncellenmeli');
    await admin.reload();
    assert(admin.pass_pin === oldHash && admin.name === 'Yeni', 'boş şifre eski hash’i korumalı');

    const passUpdate = await invoke(userController.updateUser, {
        user: { company_id: company.id },
        params: { id: String(admin.id) },
        body: { password: '3333', role: 'Admin' }
    });
    assert(passUpdate.statusCode === 200, 'şifre güncellenmeli');
    await admin.reload();
    assert(await bcrypt.compare('3333', admin.pass_pin), 'yeni şifre hash’lenmeli');

    const duplicate = await invoke(userController.updateUser, {
        user: { company_id: company.id },
        params: { id: String(cashier.id) },
        body: { pin: '2222', role: 'Kasa', branch_id: branch.id }
    });
    assert(duplicate.statusCode === 400, 'aynı PIN reddedilmeli');

    const waiter = await User.create({
        name: 'Garson', surname: 'Bir', user_pin: '3000', pass_pin: '3000', role: 'Garson',
        company_id: company.id, branch_id: branch.id
    });
    await Order.create({
        branch_id: branch.id, user_id: waiter.id, status: 'Ödendi', total_amount: 10, paid_amount: 10
    });
    const blockedDelete = await invoke(userController.deleteUser, {
        user: { company_id: company.id },
        params: { id: String(waiter.id) }
    });
    assert(
        blockedDelete.statusCode === 400 && blockedDelete.body.message.includes('PIN'),
        'siparişi olan personel açık mesajla silinmemeli'
    );
    const adminDelete = await invoke(userController.deleteUser, {
        user: { company_id: company.id },
        params: { id: String(admin.id) }
    });
    assert(adminDelete.statusCode === 400, 'yönetici silinmemeli');

    const staffed = await Branch.create({ company_id: company.id, name: 'Personelli', code: '2003' });
    await User.create({
        name: 'Sube', surname: 'Personel', user_pin: '4000', pass_pin: '4000', role: 'Garson',
        company_id: company.id, branch_id: staffed.id
    });
    const staffedDelete = await invoke(branchController.deleteBranch, {
        user: { company_id: company.id },
        params: { id: String(staffed.id) }
    });
    assert(staffedDelete.statusCode === 400, 'personelli şube silinmemeli');
    const staffedRow = await Branch.findByPk(staffed.id);
    assert(staffedRow.is_active === true, 'personelli şube aktif kalmalı');

    const empty = await Branch.create({ company_id: company.id, name: 'Bos', code: '2004' });
    const emptyDelete = await invoke(branchController.deleteBranch, {
        user: { company_id: company.id },
        params: { id: String(empty.id) }
    });
    assert(emptyDelete.statusCode === 200 && !(await Branch.findByPk(empty.id)), 'boş şube silinmeli');

    const historic = await Branch.create({ company_id: company.id, name: 'Gecmis', code: '2005' });
    await Order.create({
        branch_id: historic.id, user_id: null, status: 'Ödendi', total_amount: 5, paid_amount: 5
    });
    const historicDelete = await invoke(branchController.deleteBranch, {
        user: { company_id: company.id },
        params: { id: String(historic.id) }
    });
    const historicRow = await Branch.findByPk(historic.id);
    assert(historicDelete.statusCode === 200 && historicRow.is_active === false, 'geçmişi olan şube pasife alınmalı');
    assert(keep.is_active === true, 'diğer şube durmalı');

    const wide = await Table.create({ name: 'Tas', branch_id: branch.id, status: 'Boş' });
    const kept = await Table.create({ name: 'Orta', branch_id: branch.id, status: 'Boş' });
    const layout = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            items: [
                { id: wide.id, canvas_x: -40, canvas_y: 5000, canvas_w: 10, canvas_h: 9000 },
                { id: kept.id, canvas_x: 100, canvas_y: 80, canvas_w: 140, canvas_h: 90 }
            ]
        }
    });
    assert(layout.statusCode === 200, 'plan kaydı dönmeli');
    await wide.reload();
    await kept.reload();
    assert(wide.canvas_x === 0 && wide.canvas_w === 80 && wide.canvas_h === 800 && wide.canvas_y === 0, 'sınır dışı plan içeri alınmalı');
    assert(kept.canvas_x === 100 && kept.canvas_y === 80 && kept.canvas_w === 140 && kept.canvas_h === 90, 'geçerli plan olduğu gibi yazılmalı');

    const home = await FloorSalon.create({ branch_id: branch.id, name: 'Salon', sort_order: 0 });
    await wide.update({ salon_id: home.id });
    await kept.update({ salon_id: home.id });

    const decor = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            branch_id: branch.id,
            salon_id: home.id,
            decorations: [
                { kind: 'wall', canvas_x: -100, canvas_y: 9000, canvas_w: 10, canvas_h: 5 }
            ]
        }
    });
    assert(decor.statusCode === 200, 'süs kaydı dönmeli');
    const wall = await FloorDecoration.findOne({ where: { branch_id: branch.id, kind: 'wall' } });
    assert(wall && wall.canvas_x === 0 && wall.canvas_y === 784 && wall.canvas_w === 40 && wall.canvas_h === 16 && wall.label === 'Duvar', 'sınır dışı duvar içeri alınmalı');

    const blank = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            branch_id: branch.id,
            salon_id: home.id,
            decorations: [
                { id: wall.id, kind: 'wall', canvas_x: 0, canvas_y: 0, canvas_w: 480, canvas_h: 28 },
                { kind: 'label', label: '   ', canvas_x: 10, canvas_y: 10, canvas_w: 180, canvas_h: 48 }
            ]
        }
    });
    assert(blank.statusCode === 200, 'boş alan kaydedilmeli');
    const emptyArea = await FloorDecoration.findOne({ where: { branch_id: branch.id, kind: 'label' } });
    assert(emptyArea && emptyArea.label === '', 'boş yazı kayda geçmeli');
    assert(await FloorDecoration.count({ where: { branch_id: branch.id } }) === 2, 'boş alan duvarı silmemeli');

    const tablesOnly = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            items: [{ id: kept.id, canvas_x: 100, canvas_y: 80, canvas_w: 140, canvas_h: 90 }]
        }
    });
    assert(tablesOnly.statusCode === 200, 'yalnız masa kaydı dönmeli');
    assert(await FloorDecoration.count({ where: { branch_id: branch.id } }) === 2, 'yalnız masa kaydı süsü silmemeli');

    const named = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            branch_id: branch.id,
            salon_id: home.id,
            decorations: [
                { id: wall.id, kind: 'wall', canvas_x: 0, canvas_y: 0, canvas_w: 480, canvas_h: 28 },
                { kind: 'bar', label: 'Tezgah', canvas_x: 40, canvas_y: 40, canvas_w: 320, canvas_h: 90 },
                { kind: 'label', label: '  Sahne  ', canvas_x: 80, canvas_y: 80, canvas_w: 180, canvas_h: 48 }
            ]
        }
    });
    assert(named.statusCode === 200, 'adlı süs kaydı dönmeli');
    const rows = await FloorDecoration.findAll({ where: { branch_id: branch.id }, order: [['id', 'ASC']] });
    assert(rows.length === 3, 'üç süs durmalı');
    assert(rows.find(row => row.kind === 'bar').label === 'Bar', 'bar yazısı sabit olmalı');
    assert(rows.find(row => row.kind === 'label').label === 'Sahne', 'yazı kırpılmalı');

    const listed = await invoke(tableController.listDecorations, { user: { branch_id: branch.id } });
    const tableList = await invoke(tableController.getAllTables, { user: { branch_id: branch.id } });
    assert(listed.statusCode === 200 && listed.body.length === 3, 'süs listesi gelmeli');
    assert(Array.isArray(tableList.body) && tableList.body.every(row => row.kind == null), 'masa listesi süs taşımaz');

    const garden = await invoke(tableController.createSalon, {
        user: { company_id: company.id },
        body: { branch_id: branch.id, name: '  Bahçe  ' }
    });
    assert(garden.statusCode === 201 && garden.body.name === 'Bahçe', 'salon adı kırpılmalı');
    const gardenDecor = await invoke(tableController.saveLayout, {
        user: { company_id: company.id },
        body: {
            branch_id: branch.id,
            salon_id: garden.body.id,
            decorations: [{ kind: 'label', label: 'Bahçe', canvas_x: 20, canvas_y: 20, canvas_w: 180, canvas_h: 48 }]
        }
    });
    assert(gardenDecor.statusCode === 200, 'ikinci salon kaydı dönmeli');
    assert(await FloorDecoration.count({ where: { salon_id: home.id } }) === 3, 'ikinci salon birincinin alanını silmemeli');

    const blocked = await invoke(tableController.deleteSalon, {
        user: { company_id: company.id },
        params: { id: String(home.id) }
    });
    assert(blocked.statusCode === 400, 'masalı salon silinmemeli');
    const removedGarden = await invoke(tableController.deleteSalon, {
        user: { company_id: company.id },
        params: { id: String(garden.body.id) }
    });
    assert(removedGarden.statusCode === 200, 'masasız salon silinmeli');
    const last = await invoke(tableController.deleteSalon, {
        user: { company_id: company.id },
        params: { id: String(home.id) }
    });
    assert(last.statusCode === 400, 'son salon silinmemeli');

    const reserveReq = {
        app: { get() { return null; } },
        user: { branch_id: branch.id, role: 'Kasa' }
    };
    const reserved = await invoke(reservationController.createReservation, {
        ...reserveReq,
        body: {
            guest_name: 'Ayse',
            party_size: 4,
            table_id: tablePay.id,
            starts_at: '2026-10-16T20:00',
            phone: '555'
        }
    });
    assert(reserved.statusCode === 201 && reserved.body.status === 'Bekliyor' && reserved.body.table_name === 'Masa 1', 'rezervasyon açılmalı');
    await tablePay.reload();
    assert(tablePay.status === 'Boş', 'rezervasyon masayı doldurmamalı');
    const clash = await invoke(reservationController.createReservation, {
        ...reserveReq,
        body: { guest_name: 'Ali', party_size: 2, table_id: tablePay.id, starts_at: '2026-10-16T21:00' }
    });
    assert(clash.statusCode === 400, 'çakışan rezervasyon reddedilmeli');
    const otherTable = await invoke(reservationController.createReservation, {
        ...reserveReq,
        body: { guest_name: 'Veli', party_size: 2, table_id: tableShift.id, starts_at: '2026-10-16T20:30' }
    });
    assert(otherTable.statusCode === 201, 'başka masa aynı saatte alınmalı');
    const dayList = await invoke(reservationController.listReservations, {
        ...reserveReq,
        query: { date: '2026-10-16' }
    });
    assert(dayList.statusCode === 200 && dayList.body.length === 2, 'gün listesi iki kayıt döndürmeli');
    const arrived = await invoke(reservationController.updateReservationStatus, {
        ...reserveReq,
        user: { branch_id: branch.id, role: 'Garson' },
        params: { id: String(reserved.body.id) },
        body: { status: 'Geldi' }
    });
    assert(arrived.statusCode === 200 && arrived.body.status === 'Geldi', 'garson geldi işaretlemeli');
    const waiterCancel = await invoke(reservationController.updateReservationStatus, {
        ...reserveReq,
        user: { branch_id: branch.id, role: 'Garson' },
        params: { id: String(otherTable.body.id) },
        body: { status: 'İptal' }
    });
    assert(waiterCancel.statusCode === 403, 'garson iptal edememeli');

    console.log('FAZ6_OK');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
        for (const file of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
    });
