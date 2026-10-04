-- CreateTable
CREATE TABLE `review` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `staff_id` BIGINT NOT NULL,
    `score` INTEGER NOT NULL,
    `tags` JSON NULL,
    `content` VARCHAR(500) NULL,
    `images` JSON NULL,
    `is_anonymous` BOOLEAN NOT NULL DEFAULT false,
    `reply` VARCHAR(500) NULL,
    `replied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `review_order_id_key`(`order_id`),
    INDEX `review_staff_id_created_at_idx`(`staff_id`, `created_at`),
    INDEX `review_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `review_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `order_tb`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `review_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
