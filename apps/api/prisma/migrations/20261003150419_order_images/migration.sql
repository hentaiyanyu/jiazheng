-- AlterTable
ALTER TABLE `order_tb` ADD COLUMN `checkin_image` VARCHAR(512) NULL,
    ADD COLUMN `finish_images` JSON NULL;
