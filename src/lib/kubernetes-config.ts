/**
 * 🔧 Kubernetes ConfigMap API клиент
 * Управление ConfigMap для динамических настроек
 */

import * as k8s from '@kubernetes/client-node';

export interface ConfigMapUpdate {
  key: string;
  value: string;
}

export class KubernetesConfigManager {
  private k8sApi: k8s.CoreV1Api | null = null;
  private namespace: string;
  private configMapName: string;

  constructor() {
    this.namespace = process.env.K8S_NAMESPACE || 'canton-otc-minimal-stage';
    this.configMapName = process.env.K8S_CONFIGMAP_NAME || 'canton-otc-config';
    
    // Инициализация Kubernetes API только если запущено в кластере
    if (this.isRunningInKubernetes()) {
      this.initKubernetesApi();
    }
  }

  /**
   * Проверка, запущено ли приложение в Kubernetes
   */
  private isRunningInKubernetes(): boolean {
    return !!process.env.KUBERNETES_SERVICE_HOST;
  }

  /**
   * Инициализация Kubernetes API клиента
   */
  private initKubernetesApi(): void {
    try {
      const kc = new k8s.KubeConfig();
      
      // Используем in-cluster config если запущено в pod
      if (this.isRunningInKubernetes()) {
        kc.loadFromCluster();
      } else {
        // Fallback к kubeconfig для локальной разработки
        kc.loadFromDefault();
      }
      
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      console.log('✅ Kubernetes API client initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Kubernetes API:', error);
      this.k8sApi = null;
    }
  }

  /**
   * Получить текущий ConfigMap
   */
  async getConfigMap(): Promise<Record<string, string> | null> {
    if (!this.k8sApi) {
      console.warn('⚠️ Kubernetes API unavailable');
      return null;
    }

    try {
      const response = await this.k8sApi.readNamespacedConfigMap({
        name: this.configMapName,
        namespace: this.namespace
      });
      
      return response.data || null;
    } catch (error) {
      console.error('❌ Error getting ConfigMap:', error);
      return null;
    }
  }

  /**
   * Обновить значения в ConfigMap
   */
  async updateConfigMap(updates: ConfigMapUpdate[]): Promise<boolean> {
    if (!this.k8sApi) {
      console.warn('⚠️ Kubernetes API unavailable - using fallback mode');
      return this.updateConfigMapFallback(updates);
    }

    try {
      // Получаем текущий ConfigMap
      const currentConfigMap = await this.k8sApi.readNamespacedConfigMap({
        name: this.configMapName,
        namespace: this.namespace
      });

      // Обновляем данные
      const updatedData = { ...(currentConfigMap.data || {}) };
      
      for (const update of updates) {
        updatedData[update.key] = update.value;
        console.log(`📝 Updating ${update.key} = ${update.value}`);
      }

      // Используем replaceNamespacedConfigMap для надёжного обновления
      // Это безопаснее чем patch и гарантирует обновление
      const updatedConfigMap = {
        ...currentConfigMap,
        data: updatedData
      };

      await this.k8sApi.replaceNamespacedConfigMap({
        name: this.configMapName,
        namespace: this.namespace,
        body: updatedConfigMap
      });

      console.log('✅ ConfigMap updated successfully');
      
      // Обновляем process.env для мгновенного применения изменений
      for (const update of updates) {
        process.env[update.key] = update.value;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error updating ConfigMap:', error);
      
      // Детальное логирование ошибки
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error name:', error.name);
        console.error('Error stack:', error.stack);
      }
      
      // Если это HTTP ошибка от Kubernetes API
      if (typeof error === 'object' && error !== null) {
        const httpError = error as { response?: { statusCode?: number; body?: unknown }; body?: unknown };
        if (httpError.response) {
          console.error('HTTP Response Status:', httpError.response.statusCode);
          console.error('HTTP Response Body:', httpError.response.body);
        }
        if (httpError.body) {
          console.error('Error Body:', httpError.body);
        }
      }
      
      // Fallback - обновляем только process.env
      return this.updateConfigMapFallback(updates);
    }
  }

  /**
   * Fallback метод - обновляет только process.env (для локальной разработки)
   */
  private updateConfigMapFallback(updates: ConfigMapUpdate[]): boolean {
    console.log('🔄 Using fallback mode - updating process.env only');
    
    try {
      for (const update of updates) {
        process.env[update.key] = update.value;
        console.log(`📝 Updated in process.env: ${update.key} = ${update.value}`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Fallback update error:', error);
      return false;
    }
  }

  /**
   * Проверить доступность Kubernetes API
   */
  isAvailable(): boolean {
    return this.k8sApi !== null || !this.isRunningInKubernetes();
  }

  /**
   * Получить статус подключения
   */
  getStatus(): {
    available: boolean;
    inCluster: boolean;
    namespace: string;
    configMapName: string;
  } {
    return {
      available: this.isAvailable(),
      inCluster: this.isRunningInKubernetes(),
      namespace: this.namespace,
      configMapName: this.configMapName
    };
  }
}

// Singleton instance
let k8sConfigManager: KubernetesConfigManager | null = null;

export function getKubernetesConfigManager(): KubernetesConfigManager {
  if (!k8sConfigManager) {
    k8sConfigManager = new KubernetesConfigManager();
  }
  return k8sConfigManager;
}

