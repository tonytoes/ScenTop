-- Admin side: roles, disabled accounts, hidden products and indexes for the dashboard.

ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));
-- A disabled account cannot log in or use its saved login
ALTER TABLE users ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;

-- Hidden perfumes stay in order history but are left out of the shop
ALTER TABLE products ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE INDEX orders_created_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX users_created_idx ON users (created_at DESC);
CREATE INDEX order_items_product_idx ON order_items (product_id);
