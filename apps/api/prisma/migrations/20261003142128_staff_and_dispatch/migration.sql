-- CreateTable
CREATE TABLE `staff` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `phone` VARCHAR(128) NOT NULL,
    `avatar` VARCHAR(512) NOT NULL DEFAULT '',
    `skillTags` JSON NULL,
    `serviceDistricts` JSON NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `rating_x10` INTEGER NOT NULL DEFAULT 50,
    `order_count` INTEGER NOT NULL DEFAULT 0,
    `accept_rate` INTEGER NOT NULL DEFAULT 100,
    `on_time_rate` INTEGER NOT NULL DEFAULT 100,
    `max_daily_orders` INTEGER NOT NULL DEFAULT 4,
    `settlement_rate` INTEGER NOT NULL DEFAULT 70,
    `health_cert_expire_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'PAUSED', 'BANNED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `staff_openid_key`(`openid`),
    INDEX `staff_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_schedule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `staff_id` BIGINT NOT NULL,
    `work_date` DATE NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `staff_schedule_staff_id_work_date_idx`(`staff_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispatch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `staff_id` BIGINT NOT NULL,
    `dispatch_type` VARCHAR(16) NOT NULL DEFAULT 'AUTO',
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `score` INTEGER NOT NULL DEFAULT 0,
    `expire_at` DATETIME(3) NULL,
    `responded_at` DATETIME(3) NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispatch_order_id_idx`(`order_id`),
    INDEX `dispatch_staff_id_status_idx`(`staff_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_schedule` ADD CONSTRAINT `staff_schedule_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch` ADD CONSTRAINT `dispatch_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `order_tb`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch` ADD CONSTRAINT `dispatch_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
