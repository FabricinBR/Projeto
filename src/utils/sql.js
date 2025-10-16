export const productSummarySQL = `
  SELECT
    p.id, p.name, p.slug, p.price,
    (SELECT url FROM product_images i WHERE i.product_id=p.id ORDER BY sort_order LIMIT 1) AS image,
    COALESCE(SUM(v.stock_qty),0) AS stock_total
  FROM products p
  LEFT JOIN product_variants v ON v.product_id=p.id AND v.active=1
  WHERE p.active=1
  GROUP BY p.id, p.name, p.slug, p.price
`;

export const productBySlugSQL = `
  SELECT p.*, GROUP_CONCAT(DISTINCT cat.name ORDER BY cat.name SEPARATOR ', ') AS categories
  FROM products p
  LEFT JOIN product_categories pc ON pc.product_id=p.id
  LEFT JOIN categories cat ON cat.id=pc.category_id
  WHERE p.slug = ?
  GROUP BY p.id
`;

export const productVariantsSQL = `
  SELECT v.id AS variant_id, v.variant_sku, v.size, v.color, v.stock_qty,
         COALESCE(v.price_override, p.price) AS price
  FROM products p
  JOIN product_variants v ON v.product_id=p.id
  WHERE p.slug = ? AND v.active = 1
  ORDER BY v.size, v.color
`;

export const productsInCollectionSQL = `
  SELECT p.id, p.name, p.slug, p.price,
         COALESCE(SUM(v.stock_qty),0) AS stock_total,
         (SELECT url FROM product_images i WHERE i.product_id=p.id ORDER BY sort_order LIMIT 1) AS image
  FROM products p
  JOIN product_collections pc ON pc.product_id=p.id
  JOIN collections c ON c.id=pc.collection_id AND c.slug = ?
  LEFT JOIN product_variants v ON v.product_id=p.id AND v.active=1
  WHERE p.active=1
  GROUP BY p.id, p.name, p.slug, p.price
  ORDER BY pc.sort_order, p.id DESC
`;

export const comboPriceSQL = `
  WITH base AS (
    SELECT c.id AS combo_id, c.name,
           SUM(p.price * ci.qty) AS subtotal,
           c.discount_type, c.discount_value
    FROM combos c
    JOIN combo_items ci ON ci.combo_id=c.id
    JOIN products p ON p.id=ci.product_id
    WHERE c.slug=? AND c.active=1
    GROUP BY c.id
  )
  SELECT name, subtotal, discount_type, discount_value,
         CASE
           WHEN discount_type='PERCENT' THEN ROUND(subtotal * (1 - discount_value/100), 2)
           WHEN discount_type='AMOUNT'  THEN ROUND(GREATEST(subtotal - discount_value,0), 2)
         END AS combo_price
  FROM base`;
