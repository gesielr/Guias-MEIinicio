/**
 * Interface para métricas de emissão
 */
interface EmissionMetric {
  timestamp: number;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Interface para resumo de métricas
 */
interface MetricsSummary {
  totalEmissions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorsByType: Record<string, number>;
  lastEmission?: Date;
  certificateDaysUntilExpiry?: number;
}

/**
 * Serviço de métricas para monitoramento do sistema NFSe
 * - Coleta métricas de emissões
 * - Calcula estatísticas de performance
 * - Monitora validade de certificados
 * - Mantém janela deslizante de 24 horas
 */
export class NfseMetricsService {
  private emissions: EmissionMetric[] = [];
  private readonly WINDOW_MS = 24 * 60 * 60 * 1000; // 24 horas
  private certificateExpiry?: number;

  /**
   * Registra uma emissão no sistema de métricas
   * @param success Se a emissão foi bem-sucedida
   * @param duration Duração da emissão em milissegundos
   * @param error Mensagem de erro (se houver)
   */
  recordEmission(success: boolean, duration: number, error?: string): void {
    this.emissions.push({
      timestamp: Date.now(),
      success,
      duration,
      error
    });
    this.cleanOldMetrics();
  }

  /**
   * Registra verificação de certificado
   * @param daysUntilExpiry Dias até expiração do certificado
   */
  recordCertificateCheck(daysUntilExpiry: number): void {
    this.certificateExpiry = daysUntilExpiry;
  }

  /**
   * Obtém resumo das métricas
   * @returns Resumo das métricas calculadas
   */
  getMetrics(): MetricsSummary {
    const now = Date.now();
    const recentEmissions = this.emissions.filter(m => m.timestamp > now - this.WINDOW_MS);
    
    const totalEmissions = recentEmissions.length;
    const successCount = recentEmissions.filter(m => m.success).length;
    const failureCount = totalEmissions - successCount;
    const successRate = totalEmissions > 0 ? (successCount / totalEmissions) * 100 : 0;
    
    // Calcular durações
    const durations = recentEmissions.map(m => m.duration).sort((a, b) => a - b);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    
    // Calcular percentis
    const p95Duration = this.calculatePercentile(durations, 95);
    const p99Duration = this.calculatePercentile(durations, 99);
    
    // Agrupar erros por tipo
    const errorsByType: Record<string, number> = {};
    recentEmissions
      .filter(m => !m.success && m.error)
      .forEach(m => {
        const errorType = this.categorizeError(m.error!);
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });
    
    // Última emissão
    const lastEmission = recentEmissions.length > 0 
      ? new Date(Math.max(...recentEmissions.map(m => m.timestamp)))
      : undefined;

    return {
      totalEmissions,
      successCount,
      failureCount,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      p95Duration: Math.round(p95Duration),
      p99Duration: Math.round(p99Duration),
      errorsByType,
      lastEmission,
      certificateDaysUntilExpiry: this.certificateExpiry
    };
  }

  /**
   * Calcula percentil de uma lista de valores
   * @param values Lista ordenada de valores
   * @param percentile Percentil desejado (0-100)
   * @returns Valor do percentil
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const index = (percentile / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return values[lower];
    }
    
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  /**
   * Categoriza um erro para agrupamento
   * @param error Mensagem de erro
   * @returns Categoria do erro
   */
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout';
    }
    if (errorLower.includes('connection') || errorLower.includes('econnrefused')) {
      return 'connection';
    }
    if (errorLower.includes('certificate') || errorLower.includes('certificado')) {
      return 'certificate';
    }
    if (errorLower.includes('xml') || errorLower.includes('xsd')) {
      return 'xml_validation';
    }
    if (errorLower.includes('unauthorized') || errorLower.includes('401')) {
      return 'authentication';
    }
    if (errorLower.includes('forbidden') || errorLower.includes('403')) {
      return 'authorization';
    }
    if (errorLower.includes('bad request') || errorLower.includes('400')) {
      return 'validation';
    }
    if (errorLower.includes('server error') || errorLower.includes('5')) {
      return 'server_error';
    }
    
    return 'unknown';
  }

  /**
   * Remove métricas antigas da janela deslizante
   */
  private cleanOldMetrics(): void {
    const cutoff = Date.now() - this.WINDOW_MS;
    this.emissions = this.emissions.filter(m => m.timestamp > cutoff);
  }

  /**
   * Reseta todas as métricas
   */
  resetMetrics(): void {
    this.emissions = [];
    this.certificateExpiry = undefined;
  }

  /**
   * Obtém métricas brutas para debug
   * @returns Lista de todas as métricas
   */
  getRawMetrics(): EmissionMetric[] {
    return [...this.emissions];
  }
}
