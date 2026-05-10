const sequelize = require('../config/database');

// Modelleri İçeri Al
const User = require('./User');
const Table = require('./Table');
const Category = require('./Category');
const Product = require('./Product');
const ProductOption = require('./ProductOption');
const ProductOptionGroup = require('./ProductOptionGroup');
const Ingredient = require('./Ingredient');
const Recipe = require('./Recipe');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Shift = require('./Shift');
const SystemLog = require('./SystemLog');

// ---------------- İLİŞKİLER (RELATIONS) ----------------

// Kategori <-> Ürün İlişkisi (1 Kategori -> Çoklu Ürün)
Category.hasMany(Product, { foreignKey: 'category_id' });
Product.belongsTo(Category, { foreignKey: 'category_id' });

// Masa <-> Adisyon İlişkisi
Table.hasMany(Order, { foreignKey: 'table_id' });
Order.belongsTo(Table, { foreignKey: 'table_id' });

// Personel <-> Adisyon İlişkisi (Adisyonu Hangi Garson/Kasa Açtı)
User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

// Adisyon <-> Sipariş Kalemleri İlişkisi
Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

// Ürün <-> Sipariş Kalemleri İlişkisi
Product.hasMany(OrderItem, { foreignKey: 'product_id' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductOption, { foreignKey: 'product_id' });
ProductOption.belongsTo(Product, { foreignKey: 'product_id' });

// Seçenek <-> Ekstra Reçete İlişkisi Eklendi
ProductOption.hasMany(Recipe, { foreignKey: 'option_id', onDelete: 'CASCADE' });
Recipe.belongsTo(ProductOption, { foreignKey: 'option_id' });

Recipe.belongsTo(Ingredient, { foreignKey: 'ingredient_id' });
Ingredient.hasMany(Recipe, { foreignKey: 'ingredient_id' });

Recipe.belongsTo(Product, { foreignKey: 'product_id' });
Product.hasMany(Recipe, { foreignKey: 'product_id' });

Product.hasMany(ProductOptionGroup, { foreignKey: 'product_id', onDelete: 'CASCADE' });
ProductOptionGroup.belongsTo(Product, { foreignKey: 'product_id' });

ProductOptionGroup.hasMany(ProductOption, { foreignKey: 'option_group_id', onDelete: 'CASCADE' });
ProductOption.belongsTo(ProductOptionGroup, { foreignKey: 'option_group_id' });


// Tüm modelleri dışarı aktar
module.exports = {
    sequelize,
    User,
    Table,
    Category,
    Product,
    ProductOption,
    ProductOptionGroup,
    Ingredient,
    Recipe,
    Order,
    OrderItem,
    Shift,
    SystemLog
};