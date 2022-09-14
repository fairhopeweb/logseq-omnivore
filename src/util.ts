import { diff_match_patch } from 'diff-match-patch'
import escape from 'markdown-escape'

export interface GetArticleResponse {
  data: {
    article: {
      article: Article
    }
  }
}

export interface SearchResponse {
  data: {
    search: {
      edges: { node: Article }[]
      pageInfo: {
        hasNextPage: boolean
      }
    }
  }
}

export enum PageType {
  Article = 'ARTICLE',
  Book = 'BOOK',
  File = 'FILE',
  Profile = 'PROFILE',
  Unknown = 'UNKNOWN',
  Website = 'WEBSITE',
  Highlights = 'HIGHLIGHTS',
}

export interface Article {
  title: string
  siteName: string
  originalArticleUrl: string
  author: string
  description: string
  slug: string
  labels?: Label[]
  highlights?: Highlight[]
  updatedAt: string
  savedAt: string
  pageType: PageType
}

export interface Label {
  name: string
}

export interface Highlight {
  id: string
  quote: string
  annotation: string
  patch: string
}

export interface HighlightPoint {
  left: number
  top: number
}

const endpoint = 'https://api-prod.omnivore.app/api/graphql'

export const loadArticle = async (
  slug: string,
  apiKey: string
): Promise<Article> => {
  const res = await fetch(endpoint, {
    headers: {
      'content-type': 'application/json',
      authorization: apiKey,
    },
    body: `{"query":"\\n  query GetArticle(\\n    $username: String!\\n    $slug: String!\\n  ) {\\n    article(username: $username, slug: $slug) {\\n      ... on ArticleSuccess {\\n        article {\\n          ...ArticleFields\\n          highlights {\\n            ...HighlightFields\\n          }\\n          labels {\\n            ...LabelFields\\n          }\\n        }\\n      }\\n      ... on ArticleError {\\n        errorCodes\\n      }\\n    }\\n  }\\n  \\n  fragment ArticleFields on Article {\\n    savedAt\\n  }\\n\\n  \\n  fragment HighlightFields on Highlight {\\n  id\\n  quote\\n  annotation\\n  }\\n\\n  \\n  fragment LabelFields on Label {\\n    name\\n  }\\n\\n","variables":{"username":"me","slug":"${slug}"}}`,
    method: 'POST',
  })
  const response = (await res.json()) as GetArticleResponse

  return response.data.article.article
}

export const loadArticles = async (
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = '',
  query = ''
): Promise<[Article[], boolean]> => {
  const res = await fetch(endpoint, {
    headers: {
      'content-type': 'application/json',
      authorization: apiKey,
    },
    body: `{"query":"\\n    query Search($after: String, $first: Int, $query: String) {\\n      search(first: $first, after: $after, query: $query) {\\n        ... on SearchSuccess {\\n          edges {\\n            node {\\n              title\\n              slug\\n              siteName\\n              originalArticleUrl\\n              url\\n              author\\n              updatedAt\\n              description\\n              savedAt\\n            pageType\\n            highlights {\\n            id\\n        quote\\n        annotation\\n        patch\\n          }\\n        labels {\\n            name\\n          }\\n            }\\n          }\\n          pageInfo {\\n            hasNextPage\\n          }\\n        }\\n        ... on SearchError {\\n          errorCodes\\n        }\\n      }\\n    }\\n  ","variables":{"after":"${after}","first":${first}, "query":"${
      updatedAt ? 'updated:' + updatedAt : ''
    } sort:saved-asc ${query}"}}`,
    method: 'POST',
  })

  const jsonRes = (await res.json()) as SearchResponse
  const articles = jsonRes.data.search.edges.map((e) => e.node)

  return [articles, jsonRes.data.search.pageInfo.hasNextPage]
}

export const getHighlightLocation = (patch: string): number => {
  const dmp = new diff_match_patch()
  const patches = dmp.patch_fromText(patch)
  return patches[0].start1 || 0
}

export const getHighlightPoint = (patch: string): HighlightPoint => {
  const { bbox } = JSON.parse(patch) as { bbox: number[] }
  if (!bbox || bbox.length !== 4) {
    return { left: 0, top: 0 }
  }
  return { left: bbox[0], top: bbox[1] }
}

export const compareHighlightsInFile = (a: Highlight, b: Highlight): number => {
  // get the position of the highlight in the file
  const highlightPointA = getHighlightPoint(a.patch)
  const highlightPointB = getHighlightPoint(b.patch)
  if (highlightPointA.top === highlightPointB.top) {
    // if top is same, sort by left
    return highlightPointA.left - highlightPointB.left
  }
  // sort by top
  return highlightPointA.top - highlightPointB.top
}

export const markdownEscape = (text: string): string => {
  try {
    return escape(text)
  } catch (e) {
    console.error('markdownEscape error', e)
    return text
  }
}
