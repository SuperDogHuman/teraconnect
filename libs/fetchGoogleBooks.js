import { default as isoFetch } from 'isomorphic-unfetch'

const API_URL = 'https://www.googleapis.com/books/v1'

export async function fetchBookTitle(isbn) {
  const response = await isoFetch(`${API_URL}/volumes?q=isbn:${isbn}`)

  if (response.ok) {
    const body = await response.json()
    if (body.totalItems === 0) return ''
    return body.items[0].volumeInfo.title
  }

  const error = new Error(response.statusText)
  error.response = response

  throw error
}