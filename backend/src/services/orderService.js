const { Order, OrderItem, Product, Table, Recipe, Ingredient, sequelize } = require('../models');

exports.getActiveOrder = async (tableId) => {
    return await Order.findOne({
        where: { table_id: tableId, status: 'Açık' },
        include: [{ model: OrderItem, include: [Product] }]
    });
};

exports.addItemToOrder = async (tableId, userId, productId, basePrice, quantity = 1, selectedOptions = null) => {
    const t = await sequelize.transaction();
    try {
        let order = await Order.findOne({ where: { table_id: tableId, status: 'Açık' }, transaction: t });
        if (!order) {
            order = await Order.create({ table_id: tableId, user_id: userId, status: 'Açık', total_amount: 0 }, { transaction: t });
            await Table.update({ status: 'Dolu' }, { where: { id: tableId }, transaction: t });
        }

        // 1. Ekstra fiyat farklarını hesapla (Örn: Duble ise +250 TL eklenecek)
        let extraPrice = 0;
        if (selectedOptions && selectedOptions.length > 0) {
            for (const opt of selectedOptions) {
                extraPrice += parseFloat(opt.price_diff || 0);
            }
        }

        const finalUnitPrice = parseFloat(basePrice) + extraPrice;
        const itemTotal = finalUnitPrice * quantity;

        // 2. Akıllı Adisyon Birleştirme: Aynı üründen var mı? VARSA seçenekleri BİREBİR AYNI MI?
        const existingItems = await OrderItem.findAll({
            where: { order_id: order.id, product_id: productId, status: 'Siparişte' },
            transaction: t
        });

        let sameItem = null;
        for (const item of existingItems) {
            // Eğer daha önceki ürünle yeni gelen ürünün ekstraları %100 aynıysa (ikisi de duble, ikisi de buzluysa) birleştir.
            if (JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions)) {
                sameItem = item;
                break;
            }
        }

        if (sameItem) {
            // Aynı seçenekli ürün masada varsa, adisyonu uzatma, sadece miktarını arttır (x2 yap)
            await sameItem.increment('quantity', { by: quantity, transaction: t });
        } else {
            // Seçenekler farklıysa veya ürün ilk defa ekleniyorsa, masaya YENİ SATIR aç!
            await OrderItem.create({
                order_id: order.id,
                product_id: productId,
                price: finalUnitPrice, // Fiyat artık baz fiyat + ekstralar oldu
                quantity: quantity,
                status: 'Siparişte',
                selected_options: selectedOptions // Seçenekleri JSON olarak fişe kaydet
            }, { transaction: t });
        }

        // Ana hesabı kabart
        await order.increment('total_amount', { by: itemTotal, transaction: t });

        // Stoklardan malı düş (Reçete Motoru aynen çalışmaya devam ediyor)
        const recipes = await Recipe.findAll({ where: { product_id: productId }, transaction: t });
        for (const recipe of recipes) {
            const totalDeduction = parseFloat(recipe.amount_used) * quantity;
            await Ingredient.decrement('stock_amount', { by: totalDeduction, where: { id: recipe.ingredient_id }, transaction: t });
        }

        await t.commit();
        return { message: 'Sipariş başarıyla işlendi.' };
    } catch (error) {
        await t.rollback();
        throw new Error('Sipariş eklenemedi: ' + error.message);
    }
};

// YENİ: SATIR İPTALİ (Stoku geri koyar, hesaptan düşer)
exports.cancelOrderItem = async (itemId) => {
    const t = await sequelize.transaction();
    try {
        const item = await OrderItem.findByPk(itemId, { transaction: t });
        if (!item || item.status !== 'Siparişte') throw new Error('İptal edilecek uygun ürün bulunamadı.');

        const order = await Order.findByPk(item.order_id, { transaction: t });
        const itemTotal = parseFloat(item.price) * item.quantity;

        await order.decrement('total_amount', { by: itemTotal, transaction: t });

        const recipes = await Recipe.findAll({ where: { product_id: item.product_id }, transaction: t });
        for (const recipe of recipes) {
            const totalRefund = parseFloat(recipe.amount_used) * item.quantity;
            await Ingredient.increment('stock_amount', { by: totalRefund, where: { id: recipe.ingredient_id }, transaction: t });
        }

        await item.destroy({ transaction: t }); // Ürünü adisyondan uçur

        // Masada başka ürün kalmadıysa ve hiç para ödenmediyse masayı boşa çıkar
        const remainingItems = await OrderItem.count({ where: { order_id: order.id }, transaction: t });
        if (remainingItems === 0 && parseFloat(order.paid_amount) === 0) {
            await order.update({ status: 'İptal' }, { transaction: t });
            await Table.update({ status: 'Boş' }, { where: { id: order.table_id }, transaction: t });
        }

        await t.commit();
        return { message: 'Ürün iptal edildi, stoklar iade edildi.' };
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// YENİ: İNDİRİM UYGULAMA (Yüzde veya Direkt Para)
exports.applyDiscount = async (tableId, type, value) => {
    const order = await Order.findOne({ where: { table_id: tableId, status: 'Açık' } });
    if (!order) throw new Error('Açık adisyon yok.');

    let discountAmt = 0;
    const total = parseFloat(order.total_amount);

    if (type === 'percent') {
        discountAmt = total * (parseFloat(value) / 100);
    } else {
        discountAmt = parseFloat(value);
    }

    if (discountAmt > total) throw new Error('İndirim tutarı ana hesaptan büyük olamaz amk!');

    await order.update({ discount_amount: discountAmt });
    return { message: 'İndirim uygulandı.', discount_amount: discountAmt };
};

// GÜNCELLENDİ: ÖDEME ALMA (Adet Seçmeli ve Satır Bölmeli)
exports.processPayment = async (tableId, payAmount, paymentMethod, paidItems = []) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findOne({ where: { table_id: tableId, status: 'Açık' }, transaction: t });
        if (!order) throw new Error('Bu masada açık hesap bulunamadı.');

        const amountToPay = parseFloat(payAmount);
        const total = parseFloat(order.total_amount);
        const discount = parseFloat(order.discount_amount || 0);
        const currentPaid = parseFloat(order.paid_amount || 0);

        const remaining = total - discount - currentPaid;

        if (amountToPay > remaining + 0.01) {
            throw new Error(`Kalan tutardan (${remaining.toFixed(2)} ₺) fazla para çekemezsin!`);
        }

        // BÜYÜ BURADA: Seçili ürünlerin miktarlarını kontrol edip satırları bölüyoruz
        if (paidItems && paidItems.length > 0) {
            for (const pItem of paidItems) {
                const orderItem = await OrderItem.findOne({
                    where: { id: pItem.id, order_id: order.id, status: 'Siparişte' },
                    transaction: t
                });

                if (orderItem) {
                    if (orderItem.quantity == pItem.qty) {
                        // Hepsini ödediyse direkt status değiştir
                        await orderItem.update({ status: 'Ödendi' }, { transaction: t });
                    } else if (orderItem.quantity > pItem.qty) {
                        // Sadece bir kısmını ödediyse (Örn: 3 biranın 1'i)
                        // 1. Kalanı güncelle (Siparişte kalacak olanlar)
                        await orderItem.update({ quantity: orderItem.quantity - pItem.qty }, { transaction: t });

                        // 2. Ödenen kısmı yeni satır olarak fırlat
                        await OrderItem.create({
                            order_id: order.id,
                            product_id: orderItem.product_id,
                            price: orderItem.price,
                            quantity: pItem.qty,
                            status: 'Ödendi'
                        }, { transaction: t });
                    }
                }
            }
        }

        const newPaidAmount = currentPaid + amountToPay;

        if (newPaidAmount >= remaining - 0.01) {
            await order.update({ paid_amount: total, status: 'Ödendi' }, { transaction: t });
            await Table.update({ status: 'Boş' }, { where: { id: tableId }, transaction: t });
            await OrderItem.update({ status: 'Ödendi' }, { where: { order_id: order.id, status: 'Siparişte' }, transaction: t });

            await t.commit();
            return { message: 'Hesap komple kapatıldı.', isFullyPaid: true };
        } else {
            await order.update({ paid_amount: newPaidAmount }, { transaction: t });
            await t.commit();
            return { message: 'Kısmi ödeme alındı.', isFullyPaid: false, remaining: remaining - amountToPay };
        }
    } catch (error) {
        await t.rollback();
        throw error;
    }
};