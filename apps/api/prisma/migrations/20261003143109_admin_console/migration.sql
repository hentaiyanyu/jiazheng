-- CreateTable
CREATE TABLE `admin_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'OPERATOR', 'CS') NOT NULL DEFAULT 'OPERATOR',
    `status` INTEGER NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `admin_user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_id` BIGINT NOT NULL,
    `module` VARCHAR(32) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `target_id` VARCHAR(64) NULL,
    `detail` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_admin_id_idx`(`admin_id`),
    INDEX `audit_log_module_action_idx`(`module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
