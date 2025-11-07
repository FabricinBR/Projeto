import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadProducts = async () => {
  const filePath = path.resolve(__dirname, '../docs/assets/data/produtos.json');
  const raw = await readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data), 'Dataset precisa ser um array.');
  return data;
};

test('Dataset de produtos contém entradas válidas e consistentes', async () => {
  const products = await loadProducts();
  assert.ok(products.length > 0, 'Dataset não pode estar vazio.');

  const ids = new Set();
  const slugs = new Set();
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  for (const product of products) {
    assert.ok(product && typeof product === 'object', 'Produto deve ser um objeto.');

    // ID
    assert.ok(Number.isInteger(product.id), `ID inválido para ${product?.nome || 'produto'}.`);
    assert.ok(product.id > 0, `ID deve ser positivo (${product.id}).`);
    assert.ok(!ids.has(product.id), `ID duplicado detectado (${product.id}).`);
    ids.add(product.id);

    // Nome e textos obrigatórios
    for (const field of ['nome', 'categoria', 'descricao']) {
      assert.equal(typeof product[field], 'string', `Campo ${field} deve ser uma string.`);
      assert.ok(product[field].trim().length > 0, `Campo ${field} não pode estar vazio.`);
    }

    // Preço
    assert.equal(typeof product.preco, 'number', `Preço deve ser numérico (${product.nome}).`);
    assert.ok(Number.isFinite(product.preco), `Preço inválido (${product.nome}).`);
    assert.ok(product.preco > 0, `Preço deve ser positivo (${product.nome}).`);

    // Slug
    assert.equal(typeof product.slug, 'string', 'Slug deve ser uma string.');
    const slug = product.slug.trim();
    assert.ok(slugPattern.test(slug), `Slug inválido (${product.slug}).`);
    assert.ok(!slugs.has(slug), `Slug duplicado detectado (${slug}).`);
    slugs.add(slug);

    // Imagem
    assert.equal(typeof product.imagem, 'string', 'Caminho da imagem deve ser uma string.');
    assert.ok(product.imagem.trim().length > 0, 'Caminho da imagem não pode ser vazio.');

    // Tamanhos e cores
    assert.ok(Array.isArray(product.tamanhos), `Tamanhos inválidos (${product.nome}).`);
    assert.ok(product.tamanhos.length > 0, `Produto sem tamanhos (${product.nome}).`);
    for (const size of product.tamanhos) {
      assert.equal(typeof size, 'string', `Tamanho inválido (${product.nome}).`);
      assert.ok(size.trim().length > 0, `Tamanho vazio (${product.nome}).`);
    }

    assert.ok(Array.isArray(product.cores), `Cores inválidas (${product.nome}).`);
    assert.ok(product.cores.length > 0, `Produto sem cores (${product.nome}).`);
    for (const color of product.cores) {
      assert.equal(typeof color, 'string', `Cor inválida (${product.nome}).`);
      assert.ok(color.trim().length > 0, `Cor vazia (${product.nome}).`);
    }
  }
});
