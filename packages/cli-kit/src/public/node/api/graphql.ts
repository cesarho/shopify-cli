import {buildHeaders, httpsAgent} from '../../../private/node/api/headers.js'
import {debugLogRequestInfo, errorHandler} from '../../../private/node/api/graphql.js'
import {debugLogResponseInfo} from '../../../private/node/api.js'
import {runWithTimer} from '../metadata.js'
import {GraphQLClient, rawRequest, RequestDocument, resolveRequestDocument, Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type GraphQLResponse<T> = Awaited<ReturnType<typeof rawRequest<T>>>

interface GraphQLRequestBaseOptions<TResult> {
  api: string
  url: string
  token?: string
  addedHeaders?: {[header: string]: string}
  responseOptions?: GraphQLResponseOptions<TResult>
}

type PerformGraphQLRequestOptions<TResult> = GraphQLRequestBaseOptions<TResult> & {
  queryAsString: string
  variables?: Variables
}

export type GraphQLRequestOptions<T> = GraphQLRequestBaseOptions<T> & {
  query: RequestDocument
  variables?: Variables
}

export type GraphQLRequestDocOptions<TResult, TVariables> = GraphQLRequestBaseOptions<TResult> & {
  query: TypedDocumentNode<TResult, TVariables>
  variables?: TVariables
}

export interface GraphQLResponseOptions<T> {
  handleErrors?: boolean
  onResponse?: (response: GraphQLResponse<T>) => void
}

/**
 * Handles execution of a GraphQL query.
 *
 * @param options - GraphQL request options.
 */
async function performGraphQLRequest<TResult>(options: PerformGraphQLRequestOptions<TResult>) {
  const {token, addedHeaders, queryAsString, variables, api, url, responseOptions} = options
  const headers = {
    ...addedHeaders,
    ...buildHeaders(token),
  }

  debugLogRequestInfo(api, queryAsString, variables, headers)
  const clientOptions = {agent: await httpsAgent(), headers}
  const client = new GraphQLClient(url, clientOptions)

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    const response = await debugLogResponseInfo(
      {request: client.rawRequest<TResult>(queryAsString, variables), url},
      responseOptions?.handleErrors === false ? undefined : errorHandler(api),
    )

    if (responseOptions?.onResponse) {
      responseOptions.onResponse(response)
    }

    return response.data
  })
}

/**
 * Executes a GraphQL query to an endpoint.
 *
 * @param options - GraphQL request options.
 * @returns The response of the query of generic type <T>.
 */
export async function graphqlRequest<T>(options: GraphQLRequestOptions<T>): Promise<T> {
  return performGraphQLRequest<T>({
    ...options,
    queryAsString: options.query as string,
  })
}

/**
 * Executes a GraphQL query to an endpoint. Uses typed documents.
 *
 * @param options - GraphQL request options.
 * @returns The response of the query of generic type <TResult>.
 */
export async function graphqlRequestDoc<TResult, TVariables extends Variables>(
  options: GraphQLRequestDocOptions<TResult, TVariables>,
): Promise<TResult> {
  return performGraphQLRequest<TResult>({
    ...options,
    queryAsString: resolveRequestDocument(options.query).query,
  })
}
