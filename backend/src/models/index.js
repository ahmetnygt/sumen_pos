const sequelize = require('../config/database');

// Modelleri İçeri Al
const Company = require('./Company');
const Branch = require('./Branch');
const BranchStock = require('./BranchStock');
const User = require('./User');
const Table = require('./Table');
const FloorDecoration = require('./FloorDecoration');
const FloorSalon = require('./FloorSalon');
const Category = require('./Category');
const Product = require('./Product');
const ProductOption = require('./ProductOption');
const ProductOptionGroup = require('./ProductOptionGroup');
const Ingredient = require('./Ingredient');
const Recipe = require('./Recipe');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const OrderPayment = require('./OrderPayment');
const Shift = require('./Shift');
const SystemLog = require('./SystemLog');
const Reservation = require('./Reservation');

// ---------------- İLİŞKİLER (RELATIONS) ----------------

Company.hasMany(Branch, { foreignKey: 'company_id' });
Branch.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(User, { foreignKey: 'company_id' });
User.belongsTo(Company, { foreignKey: 'company_id' });

Branch.hasMany(User, { foreignKey: 'branch_id' });
User.belongsTo(Branch, { foreignKey: 'branch_id' });

Company.hasMany(Category, { foreignKey: 'company_id' });
Category.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Product, { foreignKey: 'company_id' });
Product.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Ingredient, { foreignKey: 'company_id' });
Ingredient.belongsTo(Company, { foreignKey: 'company_id' });

Branch.hasMany(Table, { foreignKey: 'branch_id' });
Table.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(FloorDecoration, { foreignKey: 'branch_id' });
FloorDecoration.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(FloorSalon, { foreignKey: 'branch_id' });
FloorSalon.belongsTo(Branch, { foreignKey: 'branch_id' });
FloorSalon.hasMany(Table, { foreignKey: 'salon_id' });
Table.belongsTo(FloorSalon, { foreignKey: 'salon_id' });
FloorSalon.hasMany(FloorDecoration, { foreignKey: 'salon_id' });
FloorDecoration.belongsTo(FloorSalon, { foreignKey: 'salon_id' });

Branch.hasMany(Order, { foreignKey: 'branch_id' });
Order.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(OrderItem, { foreignKey: 'branch_id' });
OrderItem.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(SystemLog, { foreignKey: 'branch_id' });
SystemLog.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(Shift, { foreignKey: 'branch_id' });
Shift.belongsTo(Branch, { foreignKey: 'branch_id' });

Branch.hasMany(BranchStock, { foreignKey: 'branch_id' });
BranchStock.belongsTo(Branch, { foreignKey: 'branch_id' });

Ingredient.hasMany(BranchStock, { foreignKey: 'ingredient_id' });
BranchStock.belongsTo(Ingredient, { foreignKey: 'ingredient_id' });

// Kategori <-> Ürün İlişkisi (1 Kategori -> Çoklu Ürün)
Category.hasMany(Product, { foreignKey: 'category_id' });
Product.belongsTo(Category, { foreignKey: 'category_id' });

// Masa <-> Adisyon İlişkisi
Table.hasMany(Order, { foreignKey: 'table_id' });
Order.belongsTo(Table, { foreignKey: 'table_id' });

Branch.hasMany(Reservation, { foreignKey: 'branch_id' });
Reservation.belongsTo(Branch, { foreignKey: 'branch_id' });
Table.hasMany(Reservation, { foreignKey: 'table_id', constraints: false });
Reservation.belongsTo(Table, { foreignKey: 'table_id', constraints: false });

// Personel <-> Adisyon İlişkisi (Adisyonu Hangi Garson/Kasa Açtı)
User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

// Adisyon <-> Sipariş Kalemleri İlişkisi
Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

Order.hasMany(OrderPayment, { foreignKey: 'order_id' });
OrderPayment.belongsTo(Order, { foreignKey: 'order_id' });
Branch.hasMany(OrderPayment, { foreignKey: 'branch_id' });
OrderPayment.belongsTo(Branch, { foreignKey: 'branch_id' });

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

// Sipariş Kalemi <-> Personel İlişkisi (Siparişi hangi garson girdi?)
User.hasMany(OrderItem, { foreignKey: 'user_id' });
OrderItem.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(OrderPayment, { foreignKey: 'user_id' });
OrderPayment.belongsTo(User, { foreignKey: 'user_id' });

// Tüm modelleri dışarı aktar
module.exports = {
    sequelize,
    Company,
    Branch,
    BranchStock,
    User,
    Table,
    FloorDecoration,
    FloorSalon,
    Category,
    Product,
    ProductOption,
    ProductOptionGroup,
    Ingredient,
    Recipe,
    Order,
    OrderItem,
    OrderPayment,
    Shift,
    SystemLog,
    Reservation
};