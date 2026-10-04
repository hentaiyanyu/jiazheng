-- CreateTable
CREATE TABLE `order_tb` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NOT NULL,
    `request_id` VARCHAR(64) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `staff_id` BIGINT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PENDING_DISPATCH', 'PENDING_ACCEPT', 'PENDING_SERVICE', 'IN_SERVICE', 'PENDING_CONFIRM', 'COMPLETED', 'RESCHEDULED', 'CANCELED', 'AFTER_SALES', 'REFUNDED', 'EXCEPTION') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `service_id` BIGINT NOT NULL,
    `sku_id` BIGINT NOT NULL,
    `service_date` DATE NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `district_code` VARCHAR(12) NOT NULL,
    `address_snapshot` JSON NOT NULL,
    `service_snapshot` JSON NOT NULL,
    `amount_service` BIGINT NOT NULL,
    `amount_addon` BIGINT NOT NULL DEFAULT 0,
    `amount_extra` BIGINT NOT NULL DEFAULT 0,
    `amount_discount` BIGINT NOT NULL DEFAULT 0,
    `amount_payable` BIGINT NOT NULL,
    `coupon_id` BIGINT NULL,
    `remark` VARCHAR(255) NULL,
    `pay_expire_at` DATETIME(3) NULL,
    `dispatch_deadline` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `accepted_at` DATETIME(3) NULL,
    `checkin_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `canceled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(255) NULL,
    `cancel_by` VARCHAR(16) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `order_tb_order_no_key`(`order_no`),
    UNIQUE INDEX `order_tb_request_id_key`(`request_id`),
    INDEX `order_tb_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    INDEX `order_tb_status_pay_expire_at_idx`(`status`, `pay_expire_at`),
    INDEX `order_tb_service_date_district_code_idx`(`service_date`, `district_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `item_type` VARCHAR(16) NOT NULL,
    `item_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `price` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `duration_minutes` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_item_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `from_status` VARCHAR(32) NULL,
    `to_status` VARCHAR(32) NOT NULL,
    `operator_type` VARCHAR(16) NOT NULL,
    `operator_id` VARCHAR(64) NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_log_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `out_trade_no` VARCHAR(64) NOT NULL,
    `transaction_id` VARCHAR(64) NULL,
    `amount` BIGINT NOT NULL,
    `channel` VARCHAR(16) NOT NULL DEFAULT 'WECHAT',
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `raw_callback` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_out_trade_no_key`(`out_trade_no`),
    UNIQUE INDEX `payment_transaction_id_key`(`transaction_id`),
    INDEX `payment_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `refund_no` VARCHAR(64) NOT NULL,
    `amount` BIGINT NOT NULL,
    `reason` VARCHAR(255) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `operator` VARCHAR(64) NULL,
    `refunded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refund_refund_no_key`(`refund_no`),
    INDEX `refund_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `order_tb`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_log` ADD CONSTRAINT `order_status_log_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `order_tb`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `order_tb`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
