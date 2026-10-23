import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createApp } from '../server.js';
import { createEmpresaController } from '../controllers/empresasController.js';

let server, base, directory, file;
const sample = { nombreComercial: 'Empresa de prueba', razonSocial: 'Prueba S.A.', telefono: '55512345', correo: 'prueba@ejemplo.com', NIT: '1234567-8', estado: 'Activo', direccion: 'Zona 1, Guatemala' };
function appForFile(filePath) {
  const controller = createEmpresaController(filePath);
  const router = express.Router();
  router.get('/', controller.getEmpresas);
  router.get('/:id', controller.getEmpresa);
  router.post('/', controller.postEmpresa);
  router.put('/:id', controller.putEmpresa);
  router.delete('/:id', controller.deleteEmpresa);
  return createApp(router);
}
async function start() {
  server = appForFile(file).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function request(route = '/empresas', method = 'GET', body) {
  return fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'empresas-test-'));
  file = path.join(directory, 'empresas.json');
  fs.writeFileSync(file, '[]');
  await start();
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.unlinkSync(file);
  fs.rmdirSync(directory);
});
test('CRUD, persistencia tras reiniciar, correo inmutable y campos protegidos', async () => {
  const created = await request('/empresas', 'POST', { ...sample, id: 999, otroCampo: 'ignorado' });
  assert.equal(created.status, 201);
  const empresa = await created.json();
  assert.equal(empresa.id, 1);
  assert.equal(empresa.otroCampo, undefined);
  const duplicate = await request('/empresas', 'POST', { ...sample, correo: sample.correo.toUpperCase() });
  assert.equal(duplicate.status, 409);
  assert.ok((await duplicate.json()).errors.NIT);
  assert.equal((await request('/empresas/1', 'PUT', { ...sample, correo: 'otro@ejemplo.com' })).status, 400);
  const { correo, ...editable } = sample;
  const updated = await request('/empresas/1', 'PUT', { ...editable, nombreComercial: 'Actualizada', id: 99 });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).correo, sample.correo);
  await new Promise(resolve => server.close(resolve));
  await start();
  const persisted = await (await request('/empresas/1')).json();
  assert.equal(persisted.nombreComercial, 'Actualizada');
  assert.equal(persisted.id, 1);
  assert.equal((await (await request()).json()).length, 1);
  assert.equal((await request('/empresas/1', 'DELETE')).status, 204);
  assert.equal((await request('/empresas/1')).status, 404);
  assert.equal((await request('/empresas/1', 'DELETE')).status, 404);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
});
test('valida campos obligatorios, tipos, correo, teléfono, NIT y estado', async () => {
  for (const invalid of [{}, { ...sample, nombreComercial: '   ' }, { ...sample, correo: 'x@' }, { ...sample, telefono: 12345678 }, { ...sample, NIT: '---' }, { ...sample, estado: 'Desconocido' }, null, []]) {
    const response = await request('/empresas', 'POST', invalid);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal((await request('/empresas/abc')).status, 400);
  assert.equal((await request('/empresas/0', 'DELETE')).status, 400);
  assert.equal((await request('/empresas/999', 'PUT', sample)).status, 404);
  assert.equal((await request('/no-existe')).status, 404);
  const malformed = await fetch(`${base}/empresas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
});
test('editar valida todos los campos y rechaza duplicados de NIT', async () => {
  const first = await (await request('/empresas', 'POST', sample)).json();
  const second = await (await request('/empresas', 'POST', { ...sample, correo: 'segunda@ejemplo.com', NIT: '456-K' })).json();
  assert.equal((await request(`/empresas/${second.id}`, 'PUT', { ...sample, correo: second.correo })).status, 409);
  assert.equal((await request(`/empresas/${first.id}`, 'PUT', { nombreComercial: 'Solo nombre' })).status, 400);
  await request(`/empresas/${first.id}`, 'DELETE');
  await request(`/empresas/${second.id}`, 'DELETE');
});
test('errores de almacenamiento devuelven JSON con HTTP 500', async () => {
  fs.renameSync(file, `${file}.backup`);
  try {
    const response = await request();
    assert.equal(response.status, 500);
    assert.equal(typeof (await response.json()).error, 'string');
  } finally { fs.renameSync(`${file}.backup`, file); }
});
