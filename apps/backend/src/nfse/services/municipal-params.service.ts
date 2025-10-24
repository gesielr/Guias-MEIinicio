import { createAdnClient } from "../adapters/adn-client";
import { getCachedParams, upsertCache } from "../repositories";

export class MunicipalParamsService {
  async getParams(municipioIbge: string, lc116Item: string) {
    const cached = await getCachedParams(municipioIbge, lc116Item);
    if (cached && cached.expiresAt > new Date()) {
      return cached.payload;
    }

    const { http, endpoint } = await createAdnClient({ module: "parametros" });
    const url = `${endpoint}/municipios`;
    const { data } = await http.get(url, {
      params: { municipio: municipioIbge, itemListaServico: lc116Item }
    });

    await upsertCache(municipioIbge, lc116Item, data);
    return data;
  }
}
