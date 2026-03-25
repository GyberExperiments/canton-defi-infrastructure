/**
 * Teletype Article Sync API
 * Автоматическое копирование статей с Teletype аккаунта @techhy
 */

import { NextRequest, NextResponse } from 'next/server'

const TELETYPE_USER = 'techhy'
const TELETYPE_API_BASE = 'https://teletype.in/api'

interface TeletypeArticle {
  id: string
  title: string
  excerpt: string
  content: string
  publishedAt: string
  url: string
}

/**
 * Получить список статей с Teletype
 */
async function fetchTeletypeArticles(): Promise<TeletypeArticle[]> {
  try {
    // Teletype API endpoint (может потребоваться корректировка)
    const response = await fetch(`${TELETYPE_API_BASE}/users/${TELETYPE_USER}/articles`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 } // Кешируем на 1 час
    })

    if (!response.ok) {
      throw new Error(`Teletype API error: ${response.status}`)
    }

    const data = await response.json()
    return data.articles || []
  } catch (error) {
    console.error('Error fetching Teletype articles:', error)
    return []
  }
}

/**
 * Получить полный контент статьи
 */
async function fetchArticleContent(articleId: string): Promise<string> {
  try {
    const response = await fetch(`${TELETYPE_API_BASE}/articles/${articleId}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`)
    }

    const data = await response.json()
    return data.content || ''
  } catch (error) {
    console.error('Error fetching article content:', error)
    return ''
  }
}

/**
 * Конвертировать Teletype контент в HTML
 */
function convertTeletypeToHTML(content: string): string {
  // Базовая конвертация Markdown/Teletype формата в HTML
  // В production можно использовать библиотеку типа marked или remark
  
  let html = content
    // Заголовки
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Жирный текст
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Курсив
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Ссылки
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Списки
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    // Параграфы
    .split('\n\n')
    .map(para => para.trim() ? `<p>${para}</p>` : '')
    .join('\n')

  return html
}

/**
 * GET /api/teletype-sync
 * Синхронизация статей с Teletype
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'

    if (action === 'list') {
      const articles = await fetchTeletypeArticles()
      return NextResponse.json({
        success: true,
        count: articles.length,
        articles: articles.map(article => ({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          url: article.url,
          publishedAt: article.publishedAt
        }))
      })
    }

    if (action === 'sync') {
      const articleId = searchParams.get('id')
      if (!articleId) {
        return NextResponse.json(
          { success: false, error: 'Article ID required' },
          { status: 400 }
        )
      }

      const content = await fetchArticleContent(articleId)
      const htmlContent = convertTeletypeToHTML(content)

      return NextResponse.json({
        success: true,
        articleId,
        content: htmlContent
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Teletype sync error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teletype-sync
 * Ручная синхронизация статьи
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleUrl } = body

    if (!articleUrl) {
      return NextResponse.json(
        { success: false, error: 'Article URL required' },
        { status: 400 }
      )
    }

    // Извлекаем ID статьи из URL
    const match = articleUrl.match(/teletype\.in\/@[\w-]+\/([\w-]+)/)
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Invalid Teletype URL' },
        { status: 400 }
      )
    }

    const articleId = match[1]
    const content = await fetchArticleContent(articleId)
    const htmlContent = convertTeletypeToHTML(content)

    // Здесь можно сохранить в базу данных или файл
    // Пока возвращаем контент

    return NextResponse.json({
      success: true,
      articleId,
      content: htmlContent,
      message: 'Article synced successfully. Add to blog manually or implement auto-save.'
    })
  } catch (error) {
    console.error('Teletype sync POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

