import * as libxmljs from "libxmljs";

const NAMESPACE = {
  nfse: "http://www.sped.fazenda.gov.br/nfse"
};

const TRIB_MUN_ORDER = [
  "tribISSQN",
  "cPaisResult",
  "tpImunidade",
  "exigSusp",
  "BM",
  "tpRetISSQN",
  "pAliq",
  "vRed",
  "vBC",
  "vBCSTRet",
  "vISSQN",
  "vDesc",
  "vLiq",
  "indIncentivo"
] as const;

type TribMunElementName = (typeof TRIB_MUN_ORDER)[number];

/**
 * Reordena os elementos do nó <tribMun> para seguir exatamente a ordem
 * definida no XSD oficial do Sistema Nacional da NFS-e.
 *
 * @param xml XML original (string)
 * @returns XML reordenado
 */
export function fixTribMunOrder(xml: string): string {
  if (!xml.includes("<tribMun")) {
    return xml;
  }

  const doc = libxmljs.parseXml(xml);
  const tribMunNodes = doc.find("//nfse:tribMun", NAMESPACE) as libxmljs.Element[];

  if (!tribMunNodes.length) {
    return xml;
  }

  tribMunNodes.forEach((tribMun) => {
    const children = tribMun.childNodes();
    const elementBuckets = new Map<string, libxmljs.Element[]>();
    const otherNodes: libxmljs.Node[] = [];

    children.forEach((child) => {
      if (child.type() === "element") {
        const element = child as libxmljs.Element;
        const name = element.name();
        const bucket = elementBuckets.get(name) ?? [];
        bucket.push(element);
        elementBuckets.set(name, bucket);
      } else {
        otherNodes.push(child);
      }
    });

    children.forEach((child) => child.remove());

    TRIB_MUN_ORDER.forEach((name) => {
      const bucket = elementBuckets.get(name as TribMunElementName);
      if (!bucket) return;
      bucket.forEach((element) => tribMun.addChild(element));
      elementBuckets.delete(name as TribMunElementName);
    });

    // Reinsere quaisquer elementos que não fazem parte da lista oficial,
    // preservando a ordem original em que foram encontrados.
    elementBuckets.forEach((bucket) => {
      bucket.forEach((element) => tribMun.addChild(element));
    });

    // Por fim, reaplica nós de texto/remanescentes (espacos, comentários)
    otherNodes.forEach((node) => tribMun.addChild(node));
  });

  return doc.toString();
}
