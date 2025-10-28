import * as libxmljs from 'libxmljs';
import { logger } from '../../logger';

/**
 * Corrige a ordem dos elementos dentro de <tribMun> conforme o XSD da API Nacional
 * Ordem correta: tribISSQN → cPaisResult → tpImunidade → exigSusp → BM → tpRetISSQN → pAliq → vRed → vBC → vBCSTRet → vISSQN → vDesc → vLiq → indIncentivo
 */
export function fixTribMunOrder(xml: string): string {
  try {
    const doc = libxmljs.parseXml(xml, {
      noblanks: true,
      noent: true,
    });

    const ns = { nfse: 'http://www.sped.fazenda.gov.br/nfse' };
    
    // Encontrar todos os elementos <tribMun>
    const tribMunNodes = doc.find('//nfse:tribMun', ns) as any[];
    
    if (tribMunNodes.length === 0) {
      logger.warn('[XML-Fixer] Nenhum elemento <tribMun> encontrado no XML');
      return xml;
    }

    // Ordem correta conforme XSD da API Nacional
    const correctOrder = [
      'tribISSQN',
      'cPaisResult',
      'tpImunidade',
      'exigSusp',
      'BM',
      'tpRetISSQN',
      'pAliq',
      'vRed',
      'vBC',
      'vBCSTRet',
      'vISSQN',
      'vDesc',
      'vLiq',
      'indIncentivo',
    ];

    tribMunNodes.forEach((tribMun: any) => {
      const children = tribMun.childNodes();
      const elements = new Map<string, any>();
      
      // Extrair elementos existentes (apenas elementos, não texto/comentários)
      children.forEach((child: any) => {
        if (child.type() === 'element') {
          const localName = child.name();
          elements.set(localName, child);
        }
      });

      // Se não há elementos para reordenar, pular
      if (elements.size === 0) {
        return;
      }

      // Remover todos os filhos do tribMun
      while (tribMun.childNodes().length > 0) {
        tribMun.childNodes()[0].remove();
      }

      // Adicionar elementos na ordem correta
      correctOrder.forEach((elementName) => {
        if (elements.has(elementName)) {
          const element = elements.get(elementName);
          tribMun.addChild(element);
        }
      });

      logger.info('[XML-Fixer] Ordem de <tribMun> corrigida', {
        elementosReordenados: Array.from(elements.keys()),
      });
    });

    const fixedXml = doc.toString({ declaration: false });
    
    logger.info('[XML-Fixer] XML corrigido com sucesso', {
      tribMunCount: tribMunNodes.length,
    });

    return fixedXml;

  } catch (error) {
    logger.error('[XML-Fixer] Erro ao corrigir ordem de tribMun', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    // Em caso de erro, retornar XML original
    return xml;
  }
}