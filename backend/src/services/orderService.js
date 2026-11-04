const { Op } = require('sequelize');
const {
    Order, OrderItem, OrderPayment, Product, ProductOption, ProductOptionGroup,
    Table, Recipe, BranchStock, Ingredient, sequelize
} = require('../models');

const MONEY_TOLERANCE = 0.01;
const PAYABLE_STATUSES = ['Siparişte', 'Hazır'];

function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return NaN;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function recordPayment(orderId, branchId, amount, method, userId, transaction) {
    const paid = roundMoney(amount);
    if (!(paid > MONEY_TOLERANCE)) return;
    if (method !== 'Nakit' && method !== 'Kredi Kartı') return;
    await OrderPayment.create({
        order_id: orderId,
        branch_id: branchId,
        user_id: userId || null,
        amount: paid,
        method
    }, { transaction });
}

function parseStoredOptions(value) {
    let current = value;
    for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
        try { current = JSON.parse(current); } catch (error) { return []; }
    }
    return Array.isArray(current) ? current : [];
}

function optionKey(options) {
    return parseStoredOptions(options).map(opt => Number(opt.id)).filter(Number.isInteger).sort((a, b) => a - b).join(',');
}

function optionIdsFromItem(rawItem) {
    if (Array.isArray(rawItem.optionIds)) {
        return rawItem.optionIds.map(id => parseInt(id, 10)).filter(Number.isInteger);
    }
    const options = rawItem.selectedOptions || rawItem.selected_options || [];
    return options.map(opt => parseInt(typeof opt === 'object' && opt ? opt.id : opt, 10)).filter(Number.isInteger);
}

function stockShortError(shortages) {
    const error = new Error('Stok yetersiz.');
    error.code = 'STOCK_SHORT';
    error.shortages = shortages;
    return error;
}

async function resolveLine(companyId, rawItem, transaction) {
    const productId = parseInt(rawItem.productId || rawItem.id, 10);
    const quantity = Number(rawItem.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Adet 1 veya daha büyük bir tam sayı olmalıdır.');
    }

    const product = await Product.findOne({
        where: { id: productId, company_id: companyId, is_active: true },
        include: [{ model: ProductOptionGroup, include: [ProductOption] }],
        transaction
    });
    if (!product) throw new Error('Ürün bulunamadı.');

    const optionIds = optionIdsFromItem(rawItem);
    if (new Set(optionIds).size !== optionIds.length) {
        throw new Error('Aynı opsiyon iki kez seçilemez.');
    }

    const groups = product.ProductOptionGroups || [];
    const optionById = new Map();
    for (const group of groups) {
        for (const opt of group.ProductOptions || []) optionById.set(opt.id, { opt, group });
    }

    const selected = optionIds.map(id => {
        const found = optionById.get(id);
        if (!found) throw new Error('Seçenek bu ürüne ait değil.');
        return found;
    });

    for (const group of groups) {
        if (group.type !== 'secim' || !(group.ProductOptions || []).length) continue;
        const picked = selected.filter(entry => entry.group.id === group.id);
        if (picked.length !== 1) throw new Error(`${group.name} için bir seçim zorunlu.`);
    }

    const selectedOptions = selected
        .map(entry => ({
            id: entry.opt.id,
            name: entry.opt.name,
            price_diff: roundMoney(entry.opt.price_diff || 0)
        }))
        .sort((a, b) => a.id - b.id);
    const unitPrice = roundMoney(roundMoney(product.price) + selectedOptions.reduce((sum, opt) => sum + opt.price_diff, 0));
    return { product, quantity, selectedOptions, unitPrice };
}

async function recipeDeltas(lines, transaction) {
    const deltas = new Map();
    for (const line of lines) {
        const baseRecipes = await Recipe.findAll({
            where: { product_id: line.product.id, option_id: null },
            transaction
        });
        for (const recipe of baseRecipes) {
            const used = parseFloat(recipe.amount_used) * line.quantity;
            deltas.set(recipe.ingredient_id, (deltas.get(recipe.ingredient_id) || 0) - used);
        }
        for (const opt of line.selectedOptions) {
            const optRecipes = await Recipe.findAll({ where: { option_id: opt.id }, transaction });
            for (const recipe of optRecipes) {
                const used = parseFloat(recipe.amount_used) * line.quantity;
                deltas.set(recipe.ingredient_id, (deltas.get(recipe.ingredient_id) || 0) - used);
            }
        }
    }
    return deltas;
}

async function incrementStock(branchId, ingredientId, delta, transaction) {
    const [row] = await BranchStock.findOrCreate({
        where: { branch_id: branchId, ingredient_id: ingredientId },
        defaults: { stock_amount: 0 },
        transaction
    });
    await row.increment('stock_amount', { by: delta, transaction });
    return row;
}

async function applyStockDeltas(branchId, deltas, confirmShortage, transaction) {
    const shortages = [];
    const prepared = [];
    for (const [ingredientId, delta] of deltas) {
        const [row] = await BranchStock.findOrCreate({
            where: { branch_id: branchId, ingredient_id: ingredientId },
            defaults: { stock_amount: 0 },
            transaction
        });
        const have = roundMoney(row.stock_amount || 0);
        if (have + delta < -0.001) {
            const ingredient = await Ingredient.findByPk(ingredientId, { transaction });
            shortages.push({
                name: ingredient?.name || 'Hammadde',
                unit: ingredient?.unit || '',
                need: roundMoney(Math.abs(delta)),
                have
            });
        }
        prepared.push({ ingredientId, delta });
    }
    if (shortages.length && !confirmShortage) throw stockShortError(shortages);
    for (const { ingredientId, delta } of prepared) {
        await incrementStock(branchId, ingredientId, delta, transaction);
    }
}

async function appendResolvedLines(order, userId, branchId, lines, transaction) {
    let added = 0;
    for (const line of lines) {
        const existingItems = await OrderItem.findAll({
            where: { order_id: order.id, product_id: line.product.id, status: 'Siparişte' },
            transaction
        });
        const wantedKey = optionKey(line.selectedOptions);
        const sameItem = existingItems.find(item => optionKey(item.selected_options) === wantedKey);
        if (sameItem) {
            await sameItem.increment('quantity', { by: line.quantity, transaction });
        } else {
            await OrderItem.create({
                order_id: order.id,
                branch_id: branchId,
                user_id: userId,
                product_id: line.product.id,
                price: line.unitPrice,
                quantity: line.quantity,
                status: 'Siparişte',
                selected_options: line.selectedOptions.length ? line.selectedOptions : null
            }, { transaction });
        }
        added = roundMoney(added + (line.unitPrice * line.quantity));
    }
    await order.increment('total_amount', { by: added, transaction });
}

exports.getActiveOrder = async (tableId, branchId) => {
    const table = await Table.findOne({ where: { id: tableId, branch_id: branchId } });
    if (!table) return null;
    const order = await Order.findOne({
        where: { table_id: tableId, branch_id: branchId, status: 'Açık' },
        include: [{ model: OrderItem, include: [Product] }]
    });
    if (!order) {
        return {
            table_name: table.name,
            OrderItems: [],
            total_amount: 0,
            paid_amount: 0,
            discount_amount: 0
        };
    }
    const payload = order.toJSON();
    payload.table_name = table.name;
    return payload;
};

async function writeTableItems(tableId, userId, items, branchId, companyId, confirmShortage) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('Sipariş kalemi yok.');
    const t = await sequelize.transaction();
    try {
        let order = await Order.findOne({
            where: { table_id: tableId, branch_id: branchId, status: 'Açık' },
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (!order) {
            const table = await Table.findOne({ where: { id: tableId, branch_id: branchId }, transaction: t });
            if (!table) throw new Error('Masa bu şubeye ait değil.');
            order = await Order.create({
                table_id: tableId,
                branch_id: branchId,
                user_id: userId,
                status: 'Açık',
                total_amount: 0
            }, { transaction: t });
            await Table.update({ status: 'Dolu' }, { where: { id: tableId, branch_id: branchId }, transaction: t });
        }

        const lines = [];
        for (const item of items) lines.push(await resolveLine(companyId, item, t));
        await applyStockDeltas(branchId, await recipeDeltas(lines, t), confirmShortage, t);
        await appendResolvedLines(order, userId, branchId, lines, t);
        await t.commit();
        return { message: 'Sipariş başarıyla işlendi.' };
    } catch (error) {
        await t.rollback();
        if (error.code === 'STOCK_SHORT') throw error;
        throw new Error(error.message || 'Sipariş eklenemedi.');
    }
}

exports.addItemToOrder = async (tableId, userId, productId, quantity, selectedOptions, branchId, companyId, confirmShortage = false) => {
    return writeTableItems(tableId, userId, [{ productId, quantity, selectedOptions }], branchId, companyId, confirmShortage);
};

exports.addItemsToOrder = async (tableId, userId, items, branchId, companyId, confirmShortage = false) => {
    return writeTableItems(tableId, userId, items, branchId, companyId, confirmShortage);
};

// YENİ: SATIR İPTALİ (Stoku geri koyar, hesaptan düşer)
async function cancelOne(itemId, branchId, t) {
        const item = await OrderItem.findOne({
            where: { id: itemId, branch_id: branchId },
            include: [{ model: Product, attributes: ['name'] }],
            transaction: t
        });
        if (!item || !PAYABLE_STATUSES.includes(item.status)) throw new Error('İptal edilecek uygun ürün bulunamadı.');

        const order = await Order.findByPk(item.order_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!order || order.status !== 'Açık') throw new Error('Açık adisyon yok.');

        const itemTotal = roundMoney(parseFloat(item.price) * item.quantity);
        const paid = roundMoney(order.paid_amount || 0);
        let newTotal = roundMoney(parseFloat(order.total_amount) - itemTotal);

        if (newTotal + MONEY_TOLERANCE < paid) {
            throw new Error('Bu ürünü iptal etmek tahsil edilmiş tutarın altına düşürür.');
        }
        if (newTotal < paid) newTotal = paid;

        const unpaidBase = roundMoney(Math.max(0, newTotal - paid));
        let discount = roundMoney(order.discount_amount || 0);
        if (!Number.isFinite(discount) || discount < 0) discount = 0;
        if (discount > unpaidBase) discount = unpaidBase;

        // 1. AŞAMA: Ana Ürün İadesi
        const baseRecipes = await Recipe.findAll({
            where: { product_id: item.product_id, option_id: null },
            transaction: t
        });
        for (const recipe of baseRecipes) {
            const totalRefund = parseFloat(recipe.amount_used) * item.quantity;
            await incrementStock(branchId, recipe.ingredient_id, totalRefund, t);
        }

        const parsedOptions = parseStoredOptions(item.selected_options);

        if (parsedOptions && parsedOptions.length > 0) {
            for (const opt of parsedOptions) {
                const optRecipes = await Recipe.findAll({
                    where: { option_id: opt.id },
                    transaction: t
                });
                for (const recipe of optRecipes) {
                    const totalRefund = parseFloat(recipe.amount_used) * item.quantity;
                    await incrementStock(branchId, recipe.ingredient_id, totalRefund, t);
                }
            }
        }

        await item.destroy({ transaction: t });

        let tableName = 'GEL-AL';
        if (order.table_id) {
            const table = await Table.findOne({ where: { id: order.table_id, branch_id: branchId }, transaction: t });
            tableName = table?.name || 'Masa';
        }
        const isFast = Boolean(order.is_fast_sale);
        const cancelled = {
            id: item.id,
            name: item.Product?.name || 'Ürün',
            quantity: item.quantity,
            options: parsedOptions.map(opt => opt && opt.name).filter(Boolean),
            amount: itemTotal,
            tableName,
            place: isFast ? 'Hızlı satış' : tableName,
            groupKey: isFast ? `fast-${order.id}` : String(order.table_id),
            created_at: item.created_at || item.createdAt || null
        };

        const patch = { total_amount: newTotal, discount_amount: discount };
        const remainingItems = await OrderItem.count({ where: { order_id: order.id }, transaction: t });
        if (remainingItems === 0 && paid <= MONEY_TOLERANCE) {
            patch.status = 'İptal';
            patch.discount_amount = 0;
            await Table.update({ status: 'Boş' }, { where: { id: order.table_id, branch_id: branchId }, transaction: t });
        }
        await order.update(patch, { transaction: t });
        return { message: 'Ürün iptal edildi, stoklar iade edildi.', cancelled };
}

exports.cancelOrderItem = async (itemId, branchId) => {
    const t = await sequelize.transaction();
    try {
        const result = await cancelOne(itemId, branchId, t);
        await t.commit();
        return result;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

exports.cancelOrderItems = async (itemIds, branchId) => {
    const ids = [...new Set((itemIds || []).map(id => parseInt(id, 10)).filter(Number.isInteger))];
    if (!ids.length) throw new Error('İptal edilecek satır yok.');
    const t = await sequelize.transaction();
    try {
        const cancelled = [];
        for (const id of ids) {
            const result = await cancelOne(id, branchId, t);
            if (result.cancelled) cancelled.push(result.cancelled);
        }
        await t.commit();
        return { message: 'Satırlar iptal edildi.', cancelled };
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// YENİ: İNDİRİM UYGULAMA (Yüzde veya Direkt Para)
exports.applyDiscount = async (tableId, type, value, branchId) => {
    const order = await Order.findOne({ where: { table_id: tableId, branch_id: branchId, status: 'Açık' } });
    if (!order) throw new Error('Açık adisyon yok.');

    const total = roundMoney(order.total_amount);
    const paid = roundMoney(order.paid_amount || 0);
    const base = roundMoney(Math.max(0, total - paid));
    const raw = parseFloat(value);

    if (!Number.isFinite(raw)) throw new Error('Geçerli bir iskonto değeri girin.');

    let discountAmt = 0;
    if (type === 'percent') {
        if (raw < 0 || raw > 100) throw new Error('İskonto yüzdesi 0 ile 100 arasında olmalıdır.');
        discountAmt = roundMoney(base * (raw / 100));
    } else if (type === 'amount') {
        if (raw < 0) throw new Error('İskonto tutarı negatif olamaz.');
        discountAmt = roundMoney(raw);
    } else {
        throw new Error('Geçersiz iskonto tipi.');
    }

    if (discountAmt > base + MONEY_TOLERANCE) {
        throw new Error('İskonto tutarı ödenmemiş tutardan büyük olamaz.');
    }
    if (discountAmt > base) discountAmt = base;

    await order.update({ discount_amount: discountAmt });
    return {
        message: discountAmt === 0 ? 'İskonto silindi.' : 'İndirim uygulandı.',
        discount_amount: discountAmt
    };
};

// GÜNCELLENDİ: ÖDEME ALMA (Adet Seçmeli ve Satır Bölmeli)
exports.processPayment = async (tableId, payAmount, paymentMethod, paidItems = [], branchId, userId = null) => {
    // Veritabanı işlemlerini güvene almak için Transaction başlatıyoruz
    const t = await sequelize.transaction();

    try {
        // 1. Masadaki açık siparişi bul
        const order = await Order.findOne({
            where: { table_id: tableId, branch_id: branchId, status: 'Açık' },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (!order) throw new Error('Bu masada açık hesap bulunamadı.');

        // 2. Matematiksel hesaplamaları yap
        const amountToPay = roundMoney(payAmount);
        const total = roundMoney(order.total_amount);
        const discount = roundMoney(order.discount_amount || 0);
        const currentPaid = roundMoney(order.paid_amount || 0);
        const netDue = roundMoney(Math.max(0, total - discount));
        const remaining = roundMoney(Math.max(0, netDue - currentPaid));

        if (!Number.isFinite(amountToPay) || amountToPay < 0) {
            throw new Error('Geçerli bir tutar girin.');
        }
        if (amountToPay > remaining + MONEY_TOLERANCE) {
            throw new Error(`Kalan tutardan (${remaining.toFixed(2)} ₺) fazla para çekemezsin!`);
        }
        if (amountToPay <= MONEY_TOLERANCE && remaining > MONEY_TOLERANCE) {
            throw new Error('Kalan varken sıfır tutarlı ödeme alınamaz.');
        }

        if (paidItems && paidItems.length > 0) {
            for (const pItem of paidItems) {
                const qty = parseInt(pItem.qty, 10);
                const orderItem = await OrderItem.findOne({
                    where: { id: pItem.id, order_id: order.id, status: { [Op.in]: PAYABLE_STATUSES } },
                    transaction: t
                });

                if (!orderItem || !Number.isInteger(qty) || qty <= 0 || qty > orderItem.quantity) {
                    throw new Error('Ödeme adedi satır miktarından büyük olamaz.');
                }

                if (orderItem.quantity === qty) {
                    await orderItem.update({ status: 'Ödendi' }, { transaction: t });
                } else {
                    await orderItem.update({
                        quantity: orderItem.quantity - qty
                    }, { transaction: t });

                    await OrderItem.create({
                        order_id: order.id,
                        branch_id: branchId,
                        user_id: orderItem.user_id,
                        product_id: orderItem.product_id,
                        price: orderItem.price,
                        quantity: qty,
                        status: 'Ödendi',
                        selected_options: orderItem.selected_options
                    }, { transaction: t });
                }
            }
        }

        const newPaidAmount = roundMoney(currentPaid + amountToPay);
        const methodToSave = paymentMethod;
        await recordPayment(order.id, branchId, amountToPay, paymentMethod, userId, t);

        if (newPaidAmount >= netDue - MONEY_TOLERANCE) {
            await order.update({
                paid_amount: netDue,
                status: 'Ödendi',
                payment_method: methodToSave
            }, { transaction: t });

            await Table.update({ status: 'Boş' }, { where: { id: tableId, branch_id: branchId }, transaction: t });
            await OrderItem.update(
                { status: 'Ödendi' },
                { where: { order_id: order.id, status: { [Op.in]: PAYABLE_STATUSES } }, transaction: t }
            );

            await t.commit();
            return { message: 'Hesap komple kapatıldı.', isFullyPaid: true };
        }

        await order.update({
            paid_amount: newPaidAmount,
            payment_method: methodToSave
        }, { transaction: t });

        await t.commit();
        return { message: 'Kısmi ödeme alındı.', isFullyPaid: false, remaining: roundMoney(remaining - amountToPay) };
    } catch (error) {
        // Hata durumunda veritabanını eski haline al (Kilitlenme ve veri kaybını önle)
        await t.rollback();
        throw error;
    }
};

// GEL-AL VE HIZLI SATIŞ MOTORU
exports.processFastSale = async (userId, items, isPaid, paymentMethod, branchId, companyId, confirmShortage = false) => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('Sipariş kalemi yok.');
    const t = await sequelize.transaction();
    try {
        const lines = [];
        for (const item of items) lines.push(await resolveLine(companyId, item, t));
        await applyStockDeltas(branchId, await recipeDeltas(lines, t), confirmShortage, t);

        const order = await Order.create({
            table_id: null,
            branch_id: branchId,
            user_id: userId,
            status: isPaid ? 'Ödendi' : 'Açık',
            total_amount: 0,
            paid_amount: 0,
            discount_amount: 0,
            is_fast_sale: true,
            payment_method: isPaid ? (paymentMethod || 'Nakit') : null
        }, { transaction: t });

        let totalAmount = 0;
        for (const line of lines) {
            const lineTotal = roundMoney(line.unitPrice * line.quantity);
            totalAmount = roundMoney(totalAmount + lineTotal);
            await OrderItem.create({
                order_id: order.id,
                branch_id: branchId,
                user_id: userId,
                product_id: line.product.id,
                price: line.unitPrice,
                quantity: line.quantity,
                status: isPaid ? 'Ödendi' : 'Siparişte',
                selected_options: line.selectedOptions.length ? line.selectedOptions : null
            }, { transaction: t });
        }

        order.total_amount = totalAmount;
        if (isPaid) {
            order.paid_amount = totalAmount;
            await recordPayment(order.id, branchId, totalAmount, paymentMethod || 'Nakit', userId, t);
        }
        await order.save({ transaction: t });
        await t.commit();
        return order;
    } catch (error) {
        await t.rollback();
        if (error.code === 'STOCK_SHORT') throw error;
        throw error;
    }
};