import { NextResponse } from 'next/server';

import { getHistory } from '@/lib/prices';
import { describeCoverage } from '@/lib/coverage';
import { SITE_URL } from '@/lib/navigation';

/**
 * OpenAPI 3.0.3 description of /api/data.
 *
 * Several API directories — APIs.guru among them — will only accept a
 * listing backed by a machine-readable spec, so this is the gate to those.
 * It is also the format Postman, Insomnia, Swagger UI and most client
 * generators import directly, which lowers the cost of anyone actually
 * using the endpoint.
 *
 * 3.0.3 rather than 3.1 deliberately: the spec here is simple enough that
 * 3.1's JSON Schema alignment buys nothing, and 3.0.3 is accepted by every
 * validator and directory without qualification.
 *
 * Served from a route rather than a static file so the historical coverage
 * in the description tracks the real series instead of being a number
 * somebody has to remember to update.
 */

export const revalidate = 86400;

export async function GET() {
    const history = await getHistory();
    const gold = history.gold;
    // Stated from the series itself: the record is monthly for most of its
    // span and only daily recently, so a flat "daily closes" claim here would
    // be wrong the moment a caller counted the points.
    const facts = describeCoverage(gold);
    const coverage = facts ? facts.sentence : 'the available record';

    const priceByWeight = {
        type: 'object',
        properties: {
            symbol: { type: 'string', example: 'XAU' },
            troy_ounce: { type: 'number', example: 4399.21 },
            gram: { type: 'number', example: 141.4379 },
            kilogram: { type: 'number', example: 141437.9 },
            tola: { type: 'number', example: 1649.6 },
            pavan: { type: 'number', example: 1131.5 },
        },
    };

    const historyPoint = {
        type: 'object',
        properties: {
            date: { type: 'string', format: 'date', example: '2026-08-17' },
            close: { type: 'number', example: 4399.21 },
        },
    };

    const spec = {
        openapi: '3.0.3',
        info: {
            title: 'ChartGoldPrice Gold & Silver Price API',
            description:
                'Free JSON API for live gold and silver spot prices and a historical close ' +
                `series covering ${coverage}. No API key, no account, no rate limit, CORS ` +
                'enabled. Prices are indicative reference values, may be delayed, and are not ' +
                'trading quotes or financial advice.',
            version: '1.0.0',
            contact: { name: 'ChartGoldPrice', url: `${SITE_URL}/gold-price-api` },
            license: { name: 'Free with attribution', url: `${SITE_URL}/terms` },
        },
        servers: [{ url: SITE_URL, description: 'Production' }],
        externalDocs: {
            description: 'Human-readable documentation',
            url: `${SITE_URL}/gold-price-api`,
        },
        paths: {
            '/api/data': {
                get: {
                    summary: 'Current gold and silver prices, with optional history',
                    description:
                        'Returns current spot prices for gold and silver in several weight units, ' +
                        'plus the gold-to-silver ratio. Pass the history parameter to include the ' +
                        `full close series (${coverage}).`,
                    operationId: 'getPrices',
                    tags: ['Prices'],
                    parameters: [
                        {
                            name: 'history',
                            in: 'query',
                            required: false,
                            description:
                                'Include the full close series for one or both metals. Omit for ' +
                                'the smaller current-price response.',
                            schema: { type: 'string', enum: ['gold', 'silver', 'both'] },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Current prices, and history when requested.',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            meta: {
                                                type: 'object',
                                                properties: {
                                                    source: { type: 'string', example: 'ChartGoldPrice' },
                                                    url: { type: 'string', format: 'uri' },
                                                    license: { type: 'string', format: 'uri' },
                                                    attribution: { type: 'string' },
                                                    disclaimer: { type: 'string' },
                                                    currency: { type: 'string', example: 'USD' },
                                                    updated_at: {
                                                        type: 'string',
                                                        format: 'date-time',
                                                        nullable: true,
                                                    },
                                                    history_source: { type: 'string', nullable: true },
                                                    docs: { type: 'string', format: 'uri' },
                                                },
                                            },
                                            prices: {
                                                type: 'object',
                                                properties: {
                                                    gold: { ...priceByWeight, nullable: true },
                                                    silver: { ...priceByWeight, nullable: true },
                                                    gold_silver_ratio: {
                                                        type: 'number',
                                                        nullable: true,
                                                        example: 67.04,
                                                    },
                                                },
                                            },
                                            history: {
                                                type: 'object',
                                                properties: {
                                                    available: {
                                                        type: 'object',
                                                        properties: {
                                                            gold: { type: 'integer', example: gold.length },
                                                            silver: {
                                                                type: 'integer',
                                                                example: history.silver.length,
                                                            },
                                                        },
                                                    },
                                                    usage: { type: 'string' },
                                                    gold: {
                                                        type: 'array',
                                                        items: historyPoint,
                                                        description:
                                                            'Present only when history=gold or history=both.',
                                                    },
                                                    silver: {
                                                        type: 'array',
                                                        items: historyPoint,
                                                        description:
                                                            'Present only when history=silver or history=both.',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        tags: [{ name: 'Prices', description: 'Spot prices and the historical close series' }],
    };

    return NextResponse.json(spec, {
        headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
            // Same open policy as /api/data: the point is to be consumed.
            'Access-Control-Allow-Origin': '*',
        },
    });
}
