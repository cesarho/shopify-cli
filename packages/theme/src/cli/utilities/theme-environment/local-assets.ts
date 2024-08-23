import {injectCdnProxy} from './proxy.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, serveStatic, setResponseHeader} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

/**
 * Handles requests for assets to the proxied Shopify CDN, serving local files.
 */
export function getAssetsHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path
    const assetsFilename = event.path.match(/^\/cdn\/.*?\/assets\/([^?]+)(\?|$)/)?.[1]
    const fileKey = assetsFilename && joinPath('assets', assetsFilename)

    if (fileKey && ctx.localThemeFileSystem.files.has(fileKey)) {
      const mimeType = lookupMimeType(fileKey)
      if (mimeType.startsWith('image/') && event.path.includes('&')) {
        // This is likely a request for an image with filters (e.g. crop),
        // which we don't support locally. Bypass and get it from the CDN.
        return
      }

      // Add header for debugging that the files come from the local assets
      setResponseHeader(event, 'X-Local-Asset', 'true')

      return serveStatic(event, {
        getContents: () => {
          const cachedValue = ctx.localThemeFileSystem.files.get(fileKey)?.value
          if (cachedValue && typeof cachedValue === 'string') return injectCdnProxy(cachedValue, ctx)

          return ctx.localThemeFileSystem
            .read(fileKey)
            .then((content) => (typeof content === 'string' ? injectCdnProxy(content, ctx) : content))
        },
        getMeta: async () => {
          const stats = await ctx.localThemeFileSystem.stat(fileKey).catch(() => {})
          return {...stats, type: mimeType}
        },
      })
    }
  })
}