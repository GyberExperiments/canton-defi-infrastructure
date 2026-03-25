/**
 * 🔐 GitHub Secrets Management Service
 * ✅ БЕЗОПАСНОЕ обновление ТОЛЬКО разрешенных секретов
 */

import { Octokit } from '@octokit/rest';
import * as tweetnaclUtil from 'tweetnacl-util';
import * as libsodium from 'libsodium-wrappers';

// ✅ ПРАВИЛЬНАЯ типизация для libsodium-wrappers
interface LibsodiumWrapper {
  ready: Promise<void>;
  crypto_box_seal: (message: Uint8Array, publicKey: Uint8Array) => Uint8Array;
}

// ✅ ПРАВИЛЬНОЕ приведение типов для libsodium-wrappers
const libsodiumTyped = libsodium as unknown as LibsodiumWrapper;

// ✅ WHITELIST: Только секреты, которые можно безопасно изменять из админки
const ALLOWED_ADMIN_SECRETS = [
  'CANTON_COIN_BUY_PRICE_USD',
  'CANTON_COIN_SELL_PRICE_USD', 
  'MIN_USDT_AMOUNT',
  'MAX_USDT_AMOUNT',
  'BUSINESS_HOURS',
  'SUPPORT_EMAIL',
  'TELEGRAM_BOT_USERNAME',
] as const;

type AllowedSecretName = typeof ALLOWED_ADMIN_SECRETS[number];

interface GitHubSecretsConfig {
  owner: string;
  repo: string;
  token: string;
}

interface SecretUpdate {
  name: AllowedSecretName;
  value: string;
}

export class GitHubSecretsService {
  private octokit: Octokit;
  private config: GitHubSecretsConfig;

  constructor(config: GitHubSecretsConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
  }

  /**
   * ✅ БЕЗОПАСНОСТЬ: Проверить, разрешен ли секрет для изменения
   */
  private isSecretAllowed(secretName: string): secretName is AllowedSecretName {
    return ALLOWED_ADMIN_SECRETS.includes(secretName as AllowedSecretName);
  }

  /**
   * ✅ БЕЗОПАСНОСТЬ: Валидация секретов перед обновлением
   */
  private validateSecrets(secrets: { name: string; value: string }[]): SecretUpdate[] {
    const validSecrets: SecretUpdate[] = [];
    const rejectedSecrets: string[] = [];

    for (const secret of secrets) {
      if (this.isSecretAllowed(secret.name)) {
        validSecrets.push(secret as SecretUpdate);
      } else {
        rejectedSecrets.push(secret.name);
        console.warn(`🚫 SECURITY: Attempted to update protected secret: ${secret.name}`);
      }
    }

    if (rejectedSecrets.length > 0) {
      console.error(`❌ SECURITY VIOLATION: Attempted to update protected secrets: ${rejectedSecrets.join(', ')}`);
      throw new Error(`Access denied to protected secrets: ${rejectedSecrets.join(', ')}`);
    }

    return validSecrets;
  }

  /**
   * Получить публичный ключ репозитория для шифрования
   */
  async getPublicKey(): Promise<{ key_id: string; key: string }> {
    try {
      const response = await this.octokit.rest.actions.getRepoPublicKey({
        owner: this.config.owner,
        repo: this.config.repo,
      });
      
      return {
        key_id: response.data.key_id,
        key: response.data.key,
      };
    } catch (error) {
      console.error('GitHub API - Get public key error:', error);
      throw new Error('Failed to get repository public key');
    }
  }

  /**
   * Шифровать секрет используя публичный ключ
   */
  private async encryptSecret(publicKey: string, secretValue: string): Promise<string> {
    try {
      const key = tweetnaclUtil.decodeBase64(publicKey);
      const message = new TextEncoder().encode(secretValue);
      
      // ✅ ПРАВИЛЬНАЯ инициализация libsodium
      await libsodiumTyped.ready;
      
      const encrypted = libsodiumTyped.crypto_box_seal(message, key);
      return tweetnaclUtil.encodeBase64(encrypted);
    } catch (error) {
      console.error('GitHub API - Encrypt secret error:', error);
      throw new Error('Failed to encrypt secret');
    }
  }

  /**
   * ✅ БЕЗОПАСНОЕ обновление секрета в GitHub
   */
  async updateSecret(secretName: AllowedSecretName, secretValue: string): Promise<boolean> {
    try {
      // ✅ Дополнительная проверка безопасности
      if (!this.isSecretAllowed(secretName)) {
        throw new Error(`Access denied to protected secret: ${secretName}`);
      }

      const { key_id, key } = await this.getPublicKey();
      const encryptedValue = await this.encryptSecret(key, secretValue);

      await this.octokit.rest.actions.createOrUpdateRepoSecret({
        owner: this.config.owner,
        repo: this.config.repo,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: key_id,
      });

      console.log(`✅ GitHub secret ${secretName} updated successfully`);
      return true;
    } catch (error) {
      console.error(`❌ GitHub API - Update secret ${secretName} error:`, error);
      return false;
    }
  }

  /**
   * ✅ БЕЗОПАСНОЕ обновление нескольких секретов одновременно
   */
  async updateMultipleSecrets(secrets: { name: string; value: string }[]): Promise<{ 
    success: string[]; 
    failed: string[]; 
    rejected: string[] 
  }> {
    try {
      // ✅ ВАЛИДАЦИЯ: Проверяем все секреты на безопасность
      const validSecrets = this.validateSecrets(secrets);
      
      const success: string[] = [];
      const failed: string[] = [];

      for (const secret of validSecrets) {
        const result = await this.updateSecret(secret.name, secret.value);
        if (result) {
          success.push(secret.name);
        } else {
          failed.push(secret.name);
        }
      }

      return { 
        success, 
        failed, 
        rejected: [] // Все отклоненные секреты уже обработаны в validateSecrets
      };
    } catch (error) {
      console.error('❌ SECURITY: Attempted to update protected secrets:', error);
      return {
        success: [],
        failed: [],
        rejected: secrets.map(s => s.name)
      };
    }
  }

  /**
   * Запустить CI/CD пайплайн через создание commit с изменениями
   * Это запустит GitHub Actions workflow автоматически
   */
  async triggerWorkflow(workflowId: string, ref: string = 'minimal-stage'): Promise<boolean> {
    try {
      // Создаем commit с изменениями для запуска workflow
      const commitMessage = `Settings updated via admin panel - ${new Date().toISOString()}`;
      const fileName = `admin-settings-${Date.now()}.txt`;
      const fileContent = `Settings updated via admin panel at ${new Date().toISOString()}\nWorkflow: ${workflowId}\nBranch: ${ref}`;
      
      // Получаем текущий commit SHA
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${ref}`,
      });
      
      const currentSha = refData.object.sha;
      
      // Создаем blob с содержимым файла
      const { data: blobData } = await this.octokit.rest.git.createBlob({
        owner: this.config.owner,
        repo: this.config.repo,
        content: fileContent,
        encoding: 'utf-8'
      });
      
      // Создаем дерево с новым файлом
      const { data: treeData } = await this.octokit.rest.git.createTree({
        owner: this.config.owner,
        repo: this.config.repo,
        base_tree: currentSha,
        tree: [{
          path: fileName,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        }]
      });
      
      // Создаем commit
      const { data: commitData } = await this.octokit.rest.git.createCommit({
        owner: this.config.owner,
        repo: this.config.repo,
        message: commitMessage,
        tree: treeData.sha,
        parents: [currentSha]
      });
      
      // Обновляем ref
      await this.octokit.rest.git.updateRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${ref}`,
        sha: commitData.sha
      });

      console.log(`✅ Commit created to trigger workflow: ${commitData.sha}`);
      console.log(`📁 File created: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ GitHub API - Create commit error:`, error);
      return false;
    }
  }

  /**
   * ✅ Получить список разрешенных секретов
   */
  getAllowedSecrets(): readonly string[] {
    return ALLOWED_ADMIN_SECRETS;
  }
}

/**
 * Создать экземпляр сервиса с конфигурацией из переменных окружения
 */
export function createGitHubSecretsService(): GitHubSecretsService {
  const config: GitHubSecretsConfig = {
    owner: process.env.REPO_OWNER || process.env.GITHUB_REPO_OWNER || 'TheMacroeconomicDao',
    repo: process.env.REPO_NAME || process.env.GITHUB_REPO_NAME || 'CantonOTC',
    token: process.env.API_TOKEN || process.env.GITHUB_TOKEN || '',
  };

  if (!config.token) {
    throw new Error('API_TOKEN or GITHUB_TOKEN environment variable is required');
  }

  return new GitHubSecretsService(config);
}
