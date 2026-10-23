import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import empresasRouter from './routes/empresas.js';

export function createApp(router = empresasRouter) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));
  app.use('/empresas', router);
  app.get('/', (req, res) => res.json({ mensaje: 'API de empresas funcionando.' }));
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El JSON enviado no es válido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud excede el tamaño permitido.' });
    console.error('Error en la API:', error.message);
    res.status(500).json({ error: 'No se pudo completar la operación. Intente nuevamente.' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`API corriendo en http://localhost:${port}`));
}
