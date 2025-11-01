import { FastifyInstance } from 'fastify';
import { NfseService, EmitNfseDto } from '../services/nfse.service';
import { createAdnClient } from '../../adapters/adn-client';

export async function nfseRoutes(app: FastifyInstance) {
  const nfseService = new NfseService();

  // 1. Emissão NFS-e
  app.post('/nfse', async (request, reply) => {
    try {
      const result = await nfseService.emit(request.body as EmitNfseDto);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 2. Consulta NFS-e por chave de acesso
  app.get('/nfse/:chaveAcesso', async (request, reply) => {
    try {
      const { http, endpoint } = createAdnClient({ module: 'contribuintes' });
      const chaveAcesso = (request.params as any).chaveAcesso;
      const url = `/nfse/${encodeURIComponent(chaveAcesso)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/xml' } });
      reply.send({ xml: data });
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 3. Consulta chave de acesso por DPS
  app.get('/dps/:id', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const id = (request.params as any).id;
      const url = `/dps/${encodeURIComponent(id)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 4. HEAD DPS (verifica existência de NFS-e)
  app.head('/dps/:id', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const id = (request.params as any).id;
      const url = `/dps/${encodeURIComponent(id)}`;
      const { status } = await http.head(url);
      reply.status(status).send();
    } catch (err: any) {
      reply.status(400).send();
    }
  });

  // 5. Registrar evento
  app.post('/nfse/:chaveAcesso/eventos', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const chaveAcesso = (request.params as any).chaveAcesso;
      const url = `/nfse/${encodeURIComponent(chaveAcesso)}/eventos`;
      const { data } = await http.post(url, request.body, { headers: { 'Content-Type': 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 6. Listar eventos
  app.get('/nfse/:chaveAcesso/eventos', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const chaveAcesso = (request.params as any).chaveAcesso;
      const url = `/nfse/${encodeURIComponent(chaveAcesso)}/eventos`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 7. Filtrar eventos por tipo
  app.get('/nfse/:chaveAcesso/eventos/:tipoEvento', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const { chaveAcesso, tipoEvento } = request.params as any;
      const url = `/nfse/${encodeURIComponent(chaveAcesso)}/eventos/${encodeURIComponent(tipoEvento)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 8. Evento específico
  app.get('/nfse/:chaveAcesso/eventos/:tipoEvento/:numSeqEvento', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'contribuintes' });
      const { chaveAcesso, tipoEvento, numSeqEvento } = request.params as any;
      const url = `/nfse/${encodeURIComponent(chaveAcesso)}/eventos/${encodeURIComponent(tipoEvento)}/${encodeURIComponent(numSeqEvento)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 9. Parâmetros municipais - convenio
  app.get('/parametros_municipais/:codigoMunicipio/convenio', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'parametros' });
      const codigoMunicipio = (request.params as any).codigoMunicipio;
      const url = `/parametros_municipais/${encodeURIComponent(codigoMunicipio)}/convenio`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 10. Parâmetros municipais - serviço
  app.get('/parametros_municipais/:codigoMunicipio/:codigoServico', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'parametros' });
      const { codigoMunicipio, codigoServico } = request.params as any;
      const url = `/parametros_municipais/${encodeURIComponent(codigoMunicipio)}/${encodeURIComponent(codigoServico)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 11. Parâmetros municipais - CPF/CNPJ
  app.get('/parametros_municipais/:codigoMunicipio/:cpfCnpj', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'parametros' });
      const { codigoMunicipio, cpfCnpj } = request.params as any;
      const url = `/parametros_municipais/${encodeURIComponent(codigoMunicipio)}/${encodeURIComponent(cpfCnpj)}`;
      const { data } = await http.get(url, { headers: { Accept: 'application/json' } });
      reply.send(data);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  // 12. Download DANFSE (PDF)
  app.get('/danfse/:chaveAcesso', async (request, reply) => {
    try {
      const { http } = createAdnClient({ module: 'danfse' });
      const chaveAcesso = (request.params as any).chaveAcesso;
      const url = `/danfse/${encodeURIComponent(chaveAcesso)}`;
      const { data } = await http.get(url, { responseType: 'arraybuffer' });
      reply.header('Content-Type', 'application/pdf');
      reply.send(Buffer.from(data));
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });
}
