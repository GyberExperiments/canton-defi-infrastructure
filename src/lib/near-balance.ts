/**
 * NEAR Balance Utilities
 * Утилиты для получения балансов токенов через NEAR RPC
 */

export interface TokenBalance {
  symbol: string
  balance: string // Баланс в human-readable формате
  balanceRaw: string // Баланс в наименьших единицах
  decimals: number
}

/**
 * Получает NEAR баланс аккаунта через RPC
 * Использует view() метод для получения состояния аккаунта
 */
export async function getNearBalance(
  accountId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<TokenBalance | null> {
  try {
    // Для NEAR баланса нам нужно сделать прямой RPC запрос
    // Используем fetch к NEAR RPC endpoint
    const rpcUrl = network === 'mainnet' 
      ? 'https://rpc.mainnet.near.org'
      : 'https://rpc.testnet.near.org'
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: accountId,
        },
      }),
    })
    
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      // Если аккаунт не существует, возвращаем null вместо ошибки
      if (data.error.message?.includes('does not exist') || 
          data.error.message?.includes('UnknownAccount')) {
        return null
      }
      throw new Error(data.error.message || 'RPC error')
    }
    
    const accountData = data.result
    if (!accountData || !accountData.amount) {
      return null
    }
    
    const balanceYocto = accountData.amount
    const balanceNear = (BigInt(balanceYocto) / BigInt('1000000000000000000000000')).toString()
    
    return {
      symbol: 'NEAR',
      balance: balanceNear,
      balanceRaw: balanceYocto,
      decimals: 24,
    }
  } catch (error) {
    console.error('Error fetching NEAR balance:', error)
    return null
  }
}

/**
 * Получает баланс токена (FT) на NEAR через RPC
 * Использует ft_balance_of метод стандарта NEAR Fungible Token
 */
export async function getTokenBalance(
  accountId: string,
  contractId: string,
  symbol: string,
  decimals: number,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<TokenBalance | null> {
  try {
    const rpcUrl = network === 'mainnet' 
      ? 'https://rpc.mainnet.near.org'
      : 'https://rpc.testnet.near.org'
    
    // Вызываем ft_balance_of метод контракта через RPC
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: contractId,
          method_name: 'ft_balance_of',
          args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64'),
        },
      }),
    })
    
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      console.log(`ft_balance_of failed for ${contractId}:`, data.error.message)
      return null
    }
    
    // Результат приходит как base64
    const result = data.result
    if (!result || !result.result || !result.result.length) {
      return null
    }
    
    const balanceRaw = Buffer.from(result.result).toString()
    const balanceDecoded = JSON.parse(balanceRaw)
    
    // balance может быть строкой или числом
    const balanceStr = balanceDecoded.toString()
    const balanceNum = (BigInt(balanceStr) / BigInt(Math.pow(10, decimals))).toString()
    
    return {
      symbol,
      balance: balanceNum,
      balanceRaw: balanceStr,
      decimals,
    }
  } catch (error) {
    console.error(`Error fetching ${symbol} balance:`, error)
    return null
  }
}

/**
 * Получает балансы всех основных токенов
 */
export async function getAllTokenBalances(
  accountId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<TokenBalance[]> {
  const balances: TokenBalance[] = []
  
  // Получаем NEAR баланс
  const nearBalance = await getNearBalance(accountId, network)
  if (nearBalance) {
    balances.push(nearBalance)
  }
  
  // TODO: Добавить получение балансов других токенов (USDT, USDC, ETH)
  // Нужны contract addresses для каждого токена
  
  return balances
}

/**
 * Проверяет достаточно ли баланса для транзакции
 */
export function hasSufficientBalance(
  balance: TokenBalance | null,
  amount: number,
  decimals: number
): boolean {
  if (!balance) {
    return false
  }
  
  const balanceNum = parseFloat(balance.balance)
  return balanceNum >= amount
}

