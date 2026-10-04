-- CreateTable
CREATE TABLE `category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    `icon` VARCHAR(512) NOT NULL DEFAULT '',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `subtitle` VARCHAR(128) NULL,
    `cover_img` VARCHAR(512) NOT NULL DEFAULT '',
    `images` JSON NULL,
    `description` TEXT NULL,
    `included_items` JSON NULL,
    `excluded_items` JSON NULL,
    `notice` TEXT NULL,
    `price_type` ENUM('DURATION', 'AREA', 'PIECE', 'PACKAGE') NOT NULL,
    `base_price_min` BIGINT NOT NULL,
    `base_price_max` BIGINT NOT NULL,
    `duration_minutes` INTEGER NOT NULL DEFAULT 120,
    `staff_count` INTEGER NOT NULL DEFAULT 1,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `service_category_id_status_idx`(`category_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_sku` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `price` BIGINT NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `area_min` INTEGER NULL,
    `area_max` INTEGER NULL,
    `staff_count` INTEGER NOT NULL DEFAULT 1,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `service_sku_service_id_status_idx`(`service_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_addon` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `price` BIGINT NOT NULL,
    `unit` VARCHAR(8) NOT NULL DEFAULT '项',
    `duration_minutes` INTEGER NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_addon_rel` (
    `service_id` BIGINT NOT NULL,
    `addon_id` BIGINT NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`service_id`, `addon_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_slot` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_date` DATE NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `district_code` VARCHAR(12) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `locked` INTEGER NOT NULL DEFAULT 0,
    `used` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `time_slot_service_date_district_code_idx`(`service_date`, `district_code`),
    UNIQUE INDEX `time_slot_service_date_start_time_district_code_key`(`service_date`, `start_time`, `district_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_rule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `city_code` VARCHAR(12) NOT NULL,
    `floor_fee_rule` JSON NOT NULL,
    `distance_fee_rule` JSON NOT NULL,
    `holiday_dates` JSON NOT NULL,
    `holiday_rate_percent` INTEGER NOT NULL DEFAULT 100,
    `night_start_hour` INTEGER NOT NULL DEFAULT 20,
    `night_rate_percent` INTEGER NOT NULL DEFAULT 100,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `price_rule_city_code_key`(`city_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `type` ENUM('FIXED', 'PERCENT') NOT NULL,
    `value` BIGINT NOT NULL,
    `min_amount` BIGINT NOT NULL DEFAULT 0,
    `total_qty` INTEGER NOT NULL DEFAULT 0,
    `issued_qty` INTEGER NOT NULL DEFAULT 0,
    `valid_type` INTEGER NOT NULL DEFAULT 1,
    `valid_start` DATETIME(3) NULL,
    `valid_end` DATETIME(3) NULL,
    `valid_days` INTEGER NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_coupon` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `coupon_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `order_id` BIGINT NULL,
    `expire_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_coupon_user_id_status_idx`(`user_id`, `status`),
    INDEX `user_coupon_coupon_id_idx`(`coupon_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service` ADD CONSTRAINT `service_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_sku` ADD CONSTRAINT `service_sku_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_addon_rel` ADD CONSTRAINT `service_addon_rel_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_addon_rel` ADD CONSTRAINT `service_addon_rel_addon_id_fkey` FOREIGN KEY (`addon_id`) REFERENCES `service_addon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_coupon` ADD CONSTRAINT `user_coupon_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_coupon` ADD CONSTRAINT `user_coupon_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
