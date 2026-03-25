/**
 * REF Finance Swap Integration
 * Модуль для выполнения реальных swap операций через REF Finance DEX
 */

import { NearSigner } from './near-signer'

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: string // В наименьших единицах (atoms)
  minAmountOut: string // Минимальная сумма для получения (slippage protection)
  solverAccountId: string
}

export interface SwapResult {
  success: boolean
  transactionHash?: string
  amountOut?: string
  error?: string
}

/**
 * REF Finance contract ID на разных сетях
 */
const REF_FINANCE_CONTRACTS = {
  mainnet: 'v2.ref-finance.near',
  testnet: 'v2.ref-finance.testnet',
}

/**
 * Mapping токенов для REF Finance
 */
const TOKEN_IDS: Record<string, string> = {
  'NEAR': 'wrap.near',
  'USDT': 'usdt.tether-token.near',
  'USDC': 'usdc.fair-launch.testnet',
  'ETH': 'aurora',
  'DAI': 'dai.fair-launch.testnet',
}

/**
 * Конвертирует символ токена в REF Finance token ID
 */
function getTokenId(symbol: string): string {
  return TOKEN_IDS[symbol.toUpperCase()] || symbol
}

/**
 * Выполняет swap через REF Finance
 * 
 * @param params Параметры swap
 * @param network NEAR network (mainnet/testnet)
 * @returns Результат swap операции
 */
export async function executeSwapThroughRefFinance(
  params: SwapParams,
  network: 'mainnet' | 'testnet' = 'testnet',
  signer: NearSigner
): Promise<SwapResult> {
  try {
    const refContractId = REF_FINANCE_CONTRACTS[network]
    const tokenInId = getTokenId(params.tokenIn)
    const tokenOutId = getTokenId(params.tokenOut)

    console.log('🔄 Executing swap through REF Finance:', {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      refContract: refContractId,
      solverAccount: params.solverAccountId,
    })

    // Шаг 1: Проверяем баланс solver для tokenIn
    const balance = await signer.checkTokenBalance(tokenInId)
    if (balance) {
      const balanceBN = BigInt(balance)
      const amountBN = BigInt(params.amountIn)
      
      if (balanceBN < amountBN) {
        return {
          success: false,
          error: `Insufficient balance: have ${balance}, need ${params.amountIn}`,
        }
      }
      
      console.log('✅ Sufficient balance:', {
        have: balance,
        need: params.amountIn,
      })
    }

    // Шаг 2: Получаем оптимальный pool ID для swap
    const poolId = await getOptimalPoolId(tokenInId, tokenOutId)
    if (!poolId) {
      return {
        success: false,
        error: 'No liquidity pool found for this token pair',
      }
    }

    console.log('📊 Using REF Finance pool:', poolId)

    // Шаг 3: Формируем msg для ft_transfer_call
    const swapMsg = JSON.stringify({
      force: 0, // 0 = normal swap, 1 = force even if no route
      actions: [
        {
          pool_id: poolId,
          token_in: tokenInId,
          token_out: tokenOutId,
          amount_in: params.amountIn,
          min_amount_out: params.minAmountOut,
        },
      ],
    })

    // Шаг 4: Выполняем ft_transfer_call через signer
    console.log('🔐 Signing and sending transaction...')
    
    const txResult = await signer.ftTransferCall(
      tokenInId, // Token contract для transfer
      refContractId, // REF Finance contract для swap
      params.amountIn, // Сумма для transfer
      swapMsg, // Инструкции для swap
      '300000000000000', // 300 TGas
      '1' // 1 yoctoNEAR для security
    )

    if (!txResult.success) {
      return {
        success: false,
        error: txResult.error || 'Transaction failed',
      }
    }

    // Шаг 5: Извлекаем amount_out из результата
    const amountOut = extractAmountOutFromReceipt(txResult)

    console.log('✅ Swap executed successfully:', {
      transactionHash: txResult.transactionHash,
      amountOut,
    })

    return {
      success: true,
      transactionHash: txResult.transactionHash,
      amountOut,
    }
  } catch (error: any) {
    console.error('❌ Error executing swap through REF Finance:', error)
    return {
      success: false,
      error: error.message || 'Swap execution failed',
    }
  }
}

/**
 * Интерфейс для ответа REF Finance API get-pool
 */
interface RefFinancePoolResponse {
  pool_id?: number
  [key: string]: unknown
}

/**
 * Получает optimal pool ID для swap между двумя токенами
 * 
 * @param tokenIn Token In ID
 * @param tokenOut Token Out ID
 * @returns Pool ID или null если не найден
 */
async function getOptimalPoolId(
  tokenIn: string,
  tokenOut: string
): Promise<number | null> {
  try {
    // REF Finance API для получения pool ID
    const response = await fetch(
      `https://indexer.ref-finance.near.org/get-pool?tokenIn=${tokenIn}&tokenOut=${tokenOut}`
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as RefFinancePoolResponse
    return data.pool_id || null
  } catch (error) {
    console.error('Error getting optimal pool ID:', error)
    return null
  }
}

/**
 * Извлекает amount_out из transaction result
 * 
 * @param txResult Transaction result from signer
 * @returns Amount out или undefined
 */
function extractAmountOutFromReceipt(txResult: any): string | undefined {
  try {
    // Пробуем извлечь из returnValue
    if (txResult.returnValue) {
      if (typeof txResult.returnValue === 'string') {
        return txResult.returnValue
      }
      
      if (txResult.returnValue.amount_out) {
        return txResult.returnValue.amount_out
      }
      
      if (txResult.returnValue.amountOut) {
        return txResult.returnValue.amountOut
      }
    }

    // Пробуем извлечь из receipts
    if (txResult.receipts && txResult.receipts.length > 0) {
      for (const receipt of txResult.receipts) {
        if (receipt.outcome?.status?.SuccessValue) {
          const buffer = Buffer.from(receipt.outcome.status.SuccessValue, 'base64')
          const value = buffer.toString('utf-8')
          
          try {
            const parsed = JSON.parse(value)
            if (parsed.amount_out || parsed.amountOut) {
              return parsed.amount_out || parsed.amountOut
            }
          } catch {
            // Возможно это просто строка с amount
            return value
          }
        }
      }
    }

    return undefined
  } catch (error) {
    console.error('Error extracting amount out from receipt:', error)
    return undefined
  }
}

/**
 * Проверяет баланс solver account для токена
 * 
 * @param signer NEAR signer
 * @param tokenId Token ID
 * @returns Баланс в наименьших единицах
 */
export async function checkSolverBalance(
  signer: NearSigner,
  tokenId: string
): Promise<string | null> {
  try {
    return await signer.checkTokenBalance(tokenId)
  } catch (error) {
    console.error('Error checking solver balance:', error)
    return null
  }
}

