import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const defaultFile = fileURLToPath(new URL('../empresas.json', import.meta.url));
const fields = ['nombreComercial', 'razonSocial', 'telefono', 'correo', 'NIT', 'estado', 'direccion'];
const limits = { nombreComercial: 150, razonSocial: 200, telefono: 15, correo: 254, NIT: 22, estado: 8, direccion: 500 };

export function createEmpresaController(filePath = defaultFile) {
  const read = () => JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const save = (empresas) => {
    const temp = `${filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(empresas, null, 2), 'utf8');
    fs.renameSync(temp, filePath);
  };
  const getId = (req, res) => {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: 'El identificador debe ser un entero positivo.' });
      return null;
    }
    return id;
  };
  const validate = (body, existing, empresas) => {
    const errors = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { body: 'Debe enviar un objeto JSON.' } };
    const data = {};
    for (const field of fields) {
      const value = existing && field === 'correo' ? existing.correo : body[field];
      if (typeof value !== 'string' || !value.trim()) errors[field] = 'Este campo es obligatorio y debe ser texto.';
      else if (value.trim().length > limits[field]) errors[field] = `Máximo ${limits[field]} caracteres.`;
      data[field] = typeof value === 'string' ? value.trim() : '';
    }
    data.correo = data.correo.toLowerCase();
    data.NIT = data.NIT.toUpperCase();
    if (existing && Object.hasOwn(body, 'correo') && body.correo !== existing.correo) errors.correo = 'El correo electrónico no se puede modificar.';
    if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) errors.correo = 'Ingrese un correo electrónico válido.';
    if (data.telefono && !/^\d{8,15}$/.test(data.telefono)) errors.telefono = 'Ingrese entre 8 y 15 dígitos, sin espacios.';
    if (data.NIT && !/^\d{1,20}-[\dK]$/.test(data.NIT)) errors.NIT = 'Use números, un guion y un dígito o K (ejemplo: 1234567-8).';
    if (data.estado && !['Activo', 'Inactivo'].includes(data.estado)) errors.estado = 'Seleccione Activo o Inactivo.';
    const others = empresas.filter(e => e.id !== existing?.id);
    const duplicate = {};
    if (others.some(e => e.correo.toLowerCase() === data.correo)) duplicate.correo = 'Ya existe una empresa con ese correo.';
    if (others.some(e => e.NIT.toUpperCase() === data.NIT)) duplicate.NIT = 'Ya existe una empresa con ese NIT.';
    return { data, errors, duplicate };
  };
  return {
    getEmpresas: (req, res) => res.json(read()),
    getEmpresa: (req, res) => {
      const id = getId(req, res);
      if (id === null) return;
      const empresa = read().find(e => e.id === id);
      if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada.' });
      res.json(empresa);
    },
    postEmpresa: (req, res) => {
      const empresas = read();
      const { data, errors, duplicate } = validate(req.body, null, empresas);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Revise los campos indicados.', errors });
      if (Object.keys(duplicate).length) return res.status(409).json({ error: 'Ya existe un registro con esos datos.', errors: duplicate });
      const empresa = { id: Math.max(0, ...empresas.map(e => e.id)) + 1, ...data };
      save([...empresas, empresa]);
      res.location(`/empresas/${empresa.id}`).status(201).json(empresa);
    },
    putEmpresa: (req, res) => {
      const id = getId(req, res);
      if (id === null) return;
      const empresas = read();
      const index = empresas.findIndex(e => e.id === id);
      if (index < 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
      const { data, errors, duplicate } = validate(req.body, empresas[index], empresas);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Revise los campos indicados.', errors });
      if (Object.keys(duplicate).length) return res.status(409).json({ error: 'Ya existe un registro con esos datos.', errors: duplicate });
      empresas[index] = { id, ...data };
      save(empresas);
      res.json(empresas[index]);
    },
    deleteEmpresa: (req, res) => {
      const id = getId(req, res);
      if (id === null) return;
      const empresas = read();
      if (!empresas.some(e => e.id === id)) return res.status(404).json({ error: 'Empresa no encontrada.' });
      save(empresas.filter(e => e.id !== id));
      res.status(204).end();
    }
  };
}

export const { getEmpresas, getEmpresa, postEmpresa, putEmpresa, deleteEmpresa } = createEmpresaController();
