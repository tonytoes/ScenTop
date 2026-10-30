-- ScenTop initial schema (PostgreSQL / Neon).
-- Money is always stored as integer centavos (PHP 1,850.00 = 185000).

CREATE TABLE users (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  first_name     text NOT NULL,
  last_name      text NOT NULL,
  phone          text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  photo_url      text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE products (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('Floral', 'Refreshing', 'Gourmand', 'Signature', 'Verdant')),
  audience        text NOT NULL DEFAULT 'unisex' CHECK (audience IN ('women', 'men', 'unisex')),
  description     text NOT NULL,
  scent_notes     text[] NOT NULL DEFAULT '{}',
  image_url       text NOT NULL,
  is_best_seller  boolean NOT NULL DEFAULT false,
  is_new_arrival  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id   integer NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size_ml      integer NOT NULL CHECK (size_ml > 0),
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  UNIQUE (product_id, size_ml)
);

CREATE TABLE cart_items (
  user_id     integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  variant_id  integer NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  quantity    integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant_id)
);

CREATE TABLE wishlist_items (
  user_id     integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id  integer NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE reviews (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  integer NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

-- Orders keep a snapshot of what was bought, so later product edits never change history.
CREATE TABLE orders (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            integer REFERENCES users (id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method     text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod')),
  subtotal_cents     integer NOT NULL,
  shipping_fee_cents integer NOT NULL,
  total_cents        integer NOT NULL,
  ship_name          text NOT NULL,
  ship_phone         text NOT NULL,
  ship_address       text NOT NULL,
  notes              text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE order_items (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id        integer REFERENCES products (id) ON DELETE SET NULL,
  product_slug      text NOT NULL,
  name              text NOT NULL,
  size_ml           integer NOT NULL,
  unit_price_cents  integer NOT NULL,
  quantity          integer NOT NULL CHECK (quantity > 0),
  image_url         text NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE contact_messages (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
