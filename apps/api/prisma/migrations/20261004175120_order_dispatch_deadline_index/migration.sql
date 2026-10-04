-- CreateIndex
CREATE INDEX `order_tb_status_dispatch_deadline_idx` ON `order_tb`(`status`, `dispatch_deadline`);
