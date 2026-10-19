-- CreateTable
CREATE TABLE `merchant` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `logo` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `businessHours` VARCHAR(50) NULL,
    `isOpen` BOOLEAN NOT NULL DEFAULT true,
    `payOnSiteEnabled` BOOLEAN NOT NULL DEFAULT false,
    `notice` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category` (
    `id` VARCHAR(32) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `category_merchantId_sort_idx`(`merchantId`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `id` VARCHAR(32) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `categoryId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `image` VARCHAR(255) NULL,
    `price` INTEGER NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `onSale` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_merchantId_categoryId_idx`(`merchantId`, `categoryId`),
    INDEX `product_onSale_idx`(`onSale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_spec_group` (
    `id` VARCHAR(32) NOT NULL,
    `productId` VARCHAR(32) NOT NULL,
    `specGroupId` VARCHAR(32) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `product_spec_group_productId_specGroupId_key`(`productId`, `specGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spec_group` (
    `id` VARCHAR(32) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `spec_group_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spec_option` (
    `id` VARCHAR(32) NOT NULL,
    `groupId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `priceDelta` INTEGER NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `spec_option_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order` (
    `id` VARCHAR(32) NOT NULL,
    `outTradeNo` VARCHAR(64) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `openid` VARCHAR(64) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `totalAmount` INTEGER NOT NULL,
    `payMethod` VARCHAR(10) NOT NULL,
    `payStatus` VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(200) NULL,

    UNIQUE INDEX `order_outTradeNo_key`(`outTradeNo`),
    INDEX `order_merchantId_status_createdAt_idx`(`merchantId`, `status`, `createdAt`),
    INDEX `order_openid_createdAt_idx`(`openid`, `createdAt`),
    INDEX `order_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item` (
    `id` VARCHAR(32) NOT NULL,
    `orderId` VARCHAR(32) NOT NULL,
    `productId` VARCHAR(32) NOT NULL,
    `productName` VARCHAR(100) NOT NULL,
    `productImage` VARCHAR(255) NULL,
    `price` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `specSnapshot` VARCHAR(500) NULL,
    `remark` VARCHAR(200) NULL,
    `subtotal` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_item_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` VARCHAR(32) NOT NULL,
    `outTradeNo` VARCHAR(64) NOT NULL,
    `transactionId` VARCHAR(64) NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_outTradeNo_key`(`outTradeNo`),
    INDEX `payment_transactionId_idx`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `printer` (
    `id` VARCHAR(32) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `sn` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `printer_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `openid` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`openid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_user` (
    `id` VARCHAR(32) NOT NULL,
    `merchantId` VARCHAR(32) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'owner',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_spec_group` ADD CONSTRAINT `product_spec_group_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_spec_group` ADD CONSTRAINT `product_spec_group_specGroupId_fkey` FOREIGN KEY (`specGroupId`) REFERENCES `spec_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spec_group` ADD CONSTRAINT `spec_group_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spec_option` ADD CONSTRAINT `spec_option_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `spec_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_outTradeNo_fkey` FOREIGN KEY (`outTradeNo`) REFERENCES `order`(`outTradeNo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `printer` ADD CONSTRAINT `printer_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user` ADD CONSTRAINT `admin_user_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

