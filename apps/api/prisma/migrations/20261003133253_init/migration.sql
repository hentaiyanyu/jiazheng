-- CreateTable
CREATE TABLE `region` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(12) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 3,
    `parent_id` BIGINT NULL,
    `is_served` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `region_code_key`(`code`),
    INDEX `region_parent_id_idx`(`parent_id`),
    INDEX `region_is_served_idx`(`is_served`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `region_id` BIGINT NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `address` VARCHAR(255) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `is_served` BOOLEAN NOT NULL DEFAULT true,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `community_region_id_idx`(`region_id`),
    INDEX `community_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `unionid` VARCHAR(64) NULL,
    `nickname` VARCHAR(64) NOT NULL DEFAULT '微信用户',
    `avatar` VARCHAR(512) NOT NULL DEFAULT '',
    `phone` VARCHAR(128) NULL,
    `member_level` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `last_order_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_openid_key`(`openid`),
    UNIQUE INDEX `user_phone_key`(`phone`),
    INDEX `user_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `address` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `contact_name` VARCHAR(32) NOT NULL,
    `contact_phone` VARCHAR(128) NOT NULL,
    `province` VARCHAR(32) NOT NULL,
    `city` VARCHAR(32) NOT NULL,
    `district` VARCHAR(32) NOT NULL,
    `region_code` VARCHAR(12) NOT NULL,
    `community_id` BIGINT NULL,
    `detail` VARCHAR(255) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `lat` DECIMAL(10, 7) NOT NULL,
    `floor` INTEGER NOT NULL DEFAULT 1,
    `has_elevator` BOOLEAN NOT NULL DEFAULT true,
    `tag` VARCHAR(16) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `address_user_id_is_default_idx`(`user_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `region` ADD CONSTRAINT `region_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community` ADD CONSTRAINT `community_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `address` ADD CONSTRAINT `address_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `address` ADD CONSTRAINT `address_community_id_fkey` FOREIGN KEY (`community_id`) REFERENCES `community`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
