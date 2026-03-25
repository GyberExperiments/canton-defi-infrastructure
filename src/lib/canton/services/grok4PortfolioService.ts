'use client';

/**
 * 🤖 GROK-4 PORTFOLIO SERVICE — PRODUCTION VERSION
 * 
 * Real Grok API integration для portfolio optimization с:
 * - Rate limiting и retry logic
 * - Response validation
 * - Token usage tracking
 * - Fallback strategies
 * 
 * Основано на официальной Grok API documentation
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';

// ========================================
// TYPES
// ========================================

export interface Grok4Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxRetries: number;
  timeout: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface PortfolioOptimizationRequest {
  portfolioId: string;
  currentPortfolio: PortfolioAsset[];
  investorProfile: InvestorProfile;
  marketData: MarketData;
  constraints: OptimizationConstraints;
  objective: OptimizationObjective;
}

export interface PortfolioAsset {
  assetId: string;
  symbol: string;
  quantity: number;
  currentPrice: number;
  weight: number;
  assetClass: string;
  expectedReturn?: number;
  volatility?: number;
}

export interface InvestorProfile {
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentHorizon: number; // months
  targetReturn: number; // annual %
  complianceLevel: 'RETAIL' | 'ACCREDITED' | 'INSTITUTIONAL';
}

export interface MarketData {
  timestamp: Date;
  assetPrices: Map<string, number>;
  volatilities: Map<string, number>;
  correlations: Map<string, Map<string, number>>;
  marketIndicators: {
    vix?: number;
    treasuryYield?: number;
    inflationRate?: number;
  };
}

export interface OptimizationConstraints {
  maxSinglePosition: number; // %
  minLiquidity: number; // %
  allowedAssetClasses: string[];
  restrictedAssets?: string[];
  maxLeverage?: number;
}

export interface OptimizationObjective {
  type: 'MAXIMIZE_SHARPE' | 'MINIMIZE_RISK' | 'MAXIMIZE_RETURN' | 'CUSTOM';
  targetReturn?: number;
  maxRisk?: number;
}

export interface OptimizationResult {
  id: string;
  portfolioId: string;
  timestamp: Date;
  
  recommendedWeights: Map<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  
  rebalanceActions: RebalanceAction[];
  reasoning: string;
  
  confidence: number; // 0.0-1.0
  modelVersion: string;
  tokenUsage: number;
}

export interface RebalanceAction {
  assetId: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
  reason: string;
}

export interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  alpha: number;
}

// ========================================
// GROK-4 PORTFOLIO SERVICE
// ========================================

export class Grok4PortfolioService extends EventEmitter {
  private config: Grok4Config;
  private requestCount = 0;
  private tokenCount = 0;
  private lastReset = Date.now();
  
  constructor(config: Partial<Grok4Config> = {}) {
    super();
    
    this.config = {
      apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY || '',
      baseUrl: 'https://api.x.ai/v1',
      model: 'grok-2-latest',
      maxRetries: 3,
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
      },
      ...config,
    };
    
    if (!this.config.apiKey && process.env.NODE_ENV === 'production') {
      throw new Error('GROK_API_KEY is required for production');
    }
  }
  
  /**
   * Optimize portfolio with rate limiting and retries
   */
  async optimizePortfolio(
    request: PortfolioOptimizationRequest
  ): Promise<OptimizationResult> {
    // Check rate limits
    await this.checkRateLimits();
    
    const prompt = this.buildPrompt(request);
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this.callGrokAPI(prompt);
        const result = this.parseResponse(response, request.portfolioId);
        
        this.emit('optimization_completed', result);
        return result;
        
      } catch (error: any) {
        if (error.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60');
          console.warn(`⚠️ Rate limited, waiting ${retryAfter}s before retry`);
          await this.delay(retryAfter * 1000);
          continue;
        }
        
        if (error.status >= 500 && attempt < this.config.maxRetries - 1) {
          // Server error - exponential backoff
          const backoffDelay = 1000 * Math.pow(2, attempt);
          console.warn(`⚠️ Server error, retrying in ${backoffDelay}ms`);
          await this.delay(backoffDelay);
          continue;
        }
        
        this.emit('optimization_failed', error);
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded for Grok API');
  }
  
  /**
   * Assess portfolio risk
   */
  async assessRisk(
    portfolio: PortfolioAsset[],
    marketData: MarketData
  ): Promise<RiskMetrics> {
    // Simplified risk assessment
    // In production, this would use Grok API for advanced risk analysis
    
    const totalValue = portfolio.reduce((sum, asset) => 
      sum + (asset.quantity * asset.currentPrice), 0
    );
    
    const weightedReturn = portfolio.reduce((sum, asset) => {
      const weight = (asset.quantity * asset.currentPrice) / totalValue;
      return sum + (weight * (asset.expectedReturn || 0));
    }, 0);
    
    const weightedVolatility = portfolio.reduce((sum, asset) => {
      const weight = (asset.quantity * asset.currentPrice) / totalValue;
      const vol = asset.volatility || 0.15;
      return sum + (weight * vol);
    }, 0);
    
    return {
      var95: -weightedVolatility * 1.65,
      var99: -weightedVolatility * 2.33,
      cvar95: -weightedVolatility * 2.0,
      maxDrawdown: weightedVolatility * 0.5,
      sharpeRatio: weightedReturn / weightedVolatility,
      sortinoRatio: weightedReturn / (weightedVolatility * 0.7),
      beta: 1.0,
      alpha: 0.0,
    };
  }
  
  private async callGrokAPI(prompt: string): Promise<any> {
    if (!this.config.apiKey) {
      // Fallback to mock response in development
      console.warn('⚠️ Grok API key not set, using mock response');
      return this.getMockResponse();
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );
    
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: PORTFOLIO_OPTIMIZER_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: prompt,
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const error: any = new Error(`Grok API error: ${response.status}`);
        error.status = response.status;
        error.headers = Object.fromEntries(response.headers.entries());
        throw error;
      }
      
      const data = await response.json();
      
      // Track token usage
      this.tokenCount += data.usage?.total_tokens || 0;
      this.requestCount++;
      
      return data;
      
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  private buildPrompt(request: PortfolioOptimizationRequest): string {
    return `
Analyze and optimize this institutional DeFi portfolio:

## Current Holdings
${JSON.stringify(request.currentPortfolio, null, 2)}

## Investor Profile
- Risk Tolerance: ${request.investorProfile.riskTolerance}
- Investment Horizon: ${request.investorProfile.investmentHorizon} months
- Target Annual Return: ${request.investorProfile.targetReturn}%
- Compliance Level: ${request.investorProfile.complianceLevel}

## Constraints
- Maximum single position: ${request.constraints.maxSinglePosition}%
- Minimum liquidity requirement: ${request.constraints.minLiquidity}%
- Allowed asset classes: ${request.constraints.allowedAssetClasses.join(', ')}

## Current Market Data
${JSON.stringify(request.marketData, null, 2)}

Provide optimized allocation with:
1. Recommended weights per asset
2. Expected annual return
3. Expected risk (VaR 95%)
4. Sharpe ratio
5. Specific rebalancing actions
6. Detailed reasoning
`;
  }
  
  private parseResponse(
    response: any,
    portfolioId: string
  ): OptimizationResult {
    const content = response.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from Grok API');
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error('Invalid JSON response from Grok API');
    }
    
    // Validate response structure
    this.validateOptimizationResult(parsed);
    
    // Convert recommendedWeights to Map
    const recommendedWeights = new Map<string, number>();
    if (parsed.recommendedWeights) {
      Object.entries(parsed.recommendedWeights).forEach(([key, value]) => {
        recommendedWeights.set(key, Number(value));
      });
    }
    
    return {
      id: `opt_${Date.now()}`,
      portfolioId,
      timestamp: new Date(),
      
      recommendedWeights,
      expectedReturn: parsed.expectedReturn || 0,
      expectedRisk: parsed.expectedRisk || 0,
      sharpeRatio: parsed.sharpeRatio || 0,
      
      rebalanceActions: parsed.rebalanceActions || [],
      reasoning: parsed.reasoning || 'No reasoning provided',
      
      confidence: parsed.confidence || 0.8,
      modelVersion: this.config.model,
      tokenUsage: response.usage?.total_tokens || 0,
    };
  }
  
  private validateOptimizationResult(parsed: any): void {
    if (typeof parsed.expectedReturn !== 'number') {
      throw new Error('Invalid expectedReturn in response');
    }
    if (typeof parsed.expectedRisk !== 'number') {
      throw new Error('Invalid expectedRisk in response');
    }
    if (typeof parsed.sharpeRatio !== 'number') {
      throw new Error('Invalid sharpeRatio in response');
    }
    if (!parsed.recommendedWeights || typeof parsed.recommendedWeights !== 'object') {
      throw new Error('Invalid recommendedWeights in response');
    }
  }
  
  private async checkRateLimits(): Promise<void> {
    const now = Date.now();
    
    // Reset counters every minute
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastReset = now;
    }
    
    // Check limits
    if (this.requestCount >= this.config.rateLimit.requestsPerMinute) {
      const waitTime = 60000 - (now - this.lastReset);
      console.warn(`⚠️ Rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }
    
    if (this.tokenCount >= this.config.rateLimit.tokensPerMinute) {
      const waitTime = 60000 - (now - this.lastReset);
      console.warn(`⚠️ Token limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private getMockResponse(): any {
    return {
      choices: [{
        message: {
          content: JSON.stringify({
            recommendedWeights: {},
            expectedReturn: 8.5,
            expectedRisk: 12.0,
            sharpeRatio: 0.71,
            rebalanceActions: [],
            reasoning: 'Mock optimization result (Grok API key not configured)',
            confidence: 0.5,
          })
        }
      }],
      usage: {
        total_tokens: 0
      }
    };
  }
}

// ========================================
// SYSTEM PROMPT
// ========================================

const PORTFOLIO_OPTIMIZER_SYSTEM_PROMPT = `You are an institutional portfolio optimizer specializing in DeFi and tokenized assets.

Your response MUST be valid JSON with this exact structure:
{
  "recommendedWeights": { "asset_id": weight_decimal },
  "expectedReturn": annual_percent,
  "expectedRisk": var_95_percent,
  "sharpeRatio": ratio,
  "rebalanceActions": [
    { "assetId": "...", "action": "BUY|SELL|HOLD", "amount": number, "reason": "..." }
  ],
  "reasoning": "detailed explanation",
  "confidence": 0.0-1.0
}

Apply Modern Portfolio Theory and consider:
- Risk-adjusted returns (Sharpe, Sortino ratios)
- Correlation between assets
- Liquidity constraints
- Compliance requirements
- Market conditions`;

// ========================================
// EXPORTS
// ========================================

export default Grok4PortfolioService;
