-- CreateTable
CREATE TABLE `notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `receiver_type` VARCHAR(16) NOT NULL,
    `receiver_id` BIGINT NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `title` VARCHAR(64) NOT NULL,
    `content` VARCHAR(255) NOT NULL,
    `order_id` BIGINT NULL,
    `page` VARCHAR(128) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `wx_status` VARCHAR(16) NULL,
    `wx_error` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_receiver_type_receiver_id_is_read_idx`(`receiver_type`, `receiver_id`, `is_read`),
    INDEX `notification_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
