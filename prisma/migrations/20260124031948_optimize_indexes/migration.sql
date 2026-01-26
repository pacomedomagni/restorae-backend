-- CreateIndex
CREATE INDEX "ContentItem_type_status_order_idx" ON "ContentItem"("type", "status", "order");

-- CreateIndex
CREATE INDEX "ContentItem_isPremium_status_idx" ON "ContentItem"("isPremium", "status");
